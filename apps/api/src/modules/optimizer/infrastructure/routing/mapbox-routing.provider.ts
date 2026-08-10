import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type { VehicleType } from '@navix/contracts';

import type { LatLng } from '../../../../shared/kernel/geo';
import { UNREACHABLE } from '../../domain/reachability';
import { assertFiniteCells, assertMatrixShape, normalizeCell } from '../../domain/matrix-integrity';
import { MAX_COORDS_BY_PROFILE, chooseMatrixProfile } from '../../domain/matrix-profile';
import { resolveRoutingProfile, type RoutingProfileMapping } from '../../domain/routing-profile';
import type { RouteMatrix, RoutingProviderPort } from '../../domain/ports/routing-provider.port';
import { OptimizerMetrics } from '../observability/optimizer-metrics';
import { haversineMatrix } from './haversine-routing.provider';

/**
 * Limite de coordenadas por requisição, para o perfil escolhido. O
 * `driving-traffic` é mais apertado (10) — ver `matrix-profile.ts`.
 */
const maxCoordsFor = (perfil: RoutingProfileMapping): number =>
  MAX_COORDS_BY_PROFILE[perfil.profile];

/**
 * Coordenadas por bloco no ladrilhamento (ADR-0107).
 *
 * Cada requisição carrega **dois** blocos — as origens e os destinos —, então
 * `2 × 12 = 24` cabe no limite de 25 com uma folga. Blocos maiores reduziriam o
 * número de requisições, mas não cabem; menores multiplicariam as chamadas sem
 * ganho.
 */
const BLOCK = 12;

/**
 * Teto do ladrilhamento. Acima disto o número de requisições cresce ao
 * quadrado (`⌈n/12⌉²`) e esbarra no limite de taxa do provedor: 100 pontos já
 * são 81 chamadas. Além do teto o resultado é geométrico — e **declarado**,
 * que é o ponto: o problema nunca foi degradar, foi degradar em silêncio.
 */
const MAX_TILED_COORDS = 100;

/** Requisições em voo ao mesmo tempo. Segura a mão no limite de taxa. */
const CONCURRENCY = 6;

const TIMEOUT_MS = 4000;

interface MatrixResponse {
  code?: string;
  distances?: (number | null)[][]; // metros
  durations?: (number | null)[][]; // segundos
}

/** Matriz em que nenhum par tem rota — só a diagonal (ficar parado) é possível. */
function allUnreachable(n: number): RouteMatrix {
  const build = (): number[][] =>
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j): number => (i === j ? 0 : UNREACHABLE)),
    );
  return { distanceKm: build(), durationMin: build(), source: 'provider' };
}

/** Índices em blocos de no máximo [BLOCK] posições. */
function blocksOf(n: number): number[][] {
  const blocks: number[][] = [];
  for (let start = 0; start < n; start += BLOCK) {
    blocks.push(Array.from({ length: Math.min(BLOCK, n - start) }, (_, k) => start + k));
  }
  return blocks;
}

/** Executa as tarefas com no máximo [CONCURRENCY] em voo. */
async function inBatches<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(tasks.slice(i, i + CONCURRENCY).map((run) => run()))));
  }
  return results;
}

/**
 * Provedor de roteamento **real** via Mapbox Matrix API (ADR-0027): distância e
 * duração medidas na rede viária.
 *
 * **Não é trânsito em tempo real.** O perfil `driving` usa velocidades típicas
 * da via; quem lê trânsito é `driving-traffic`, e ele só é pedido quando se
 * justifica (ADR-0126). A documentação anterior deste ficheiro afirmava
 * «duração de trânsito medida», o que era falso e passou a importar quando a
 * duração virou objetivo (ADR-0111).
 *
 * ## Acima de 25 pontos (ADR-0107)
 *
 * O Matrix API aceita 25 coordenadas por requisição, e o motor aceita rotas bem
 * maiores. Antes, passar de 25 caía direto em Haversine — sem erro, sem aviso,
 * sem nada no plano: quem configurou (e paga) roteamento real recebia linha
 * reta e não tinha como saber.
 *
 * Agora a matriz é montada em **ladrilhos**: cada requisição pede um bloco de
 * origens contra um bloco de destinos, e o resultado é remontado na posição
 * global. É tudo-ou-nada — se qualquer ladrilho falhar, a matriz inteira volta
 * geométrica, porque misturar trecho medido com trecho estimado produziria
 * exatamente os custos fictícios que ninguém consegue auditar depois.
 *
 * Resiliente por design: sem token, acima do teto de ladrilhamento, ou em
 * qualquer falha externa, **degrada para Haversine** — mas o resultado sempre
 * declara de onde veio (`source`), e `MAPS_REQUIRE_PROVIDER=true` transforma a
 * degradação em erro para quem não a aceita.
 */
@Injectable()
export class MapboxRoutingProvider implements RoutingProviderPort {
  private readonly logger = new Logger('MapboxRouting');
  private readonly token: string | undefined;
  private readonly requireProvider: boolean;
  private warned = false;

  constructor(
    config: AppConfigService,
    private readonly metrics: OptimizerMetrics,
  ) {
    this.token = config.maps.mapboxToken;
    this.requireProvider = config.maps.requireProvider;
  }

  async matrix(
    points: LatLng[],
    speedKmh: number,
    vehicleType?: VehicleType | null,
    departureAt?: Date | null,
  ): Promise<RouteMatrix> {
    // Mapeamento explícito, resolvido uma vez e usado em toda requisição desta
    // matriz — inclusive nos ladrilhos (ADR-0108).
    const base = resolveRoutingProfile(vehicleType);
    const escolha = chooseMatrixProfile({
      base: base.profile,
      points: points.length,
      departureAt,
    });
    const perfil: RoutingProfileMapping = { ...base, profile: escolha.profile };

    if (!this.token || points.length < 2) {
      return this.geometric(points, speedKmh, 'sem token do provedor', 'no-token');
    }
    if (points.length > MAX_TILED_COORDS) {
      this.metrics.observeMatrixCoordsExceeded(points.length);
      return this.geometric(
        points,
        speedKmh,
        `${points.length} pontos acima do teto de ${MAX_TILED_COORDS} para ladrilhamento`,
        'coords-exceeded',
      );
    }

    const inicio = Date.now();
    try {
      const matriz =
        points.length <= maxCoordsFor(perfil)
          ? await this.singleRequest(points, perfil, speedKmh)
          : await this.tiled(points, perfil, speedKmh);
      this.metrics.observeMatrix('success', escolha.profile, (Date.now() - inicio) / 1000);
      return matriz;
    } catch (err) {
      this.metrics.observeMatrix(kindOf(err), escolha.profile, (Date.now() - inicio) / 1000);
      return this.geometric(points, speedKmh, sanitize(err), kindOf(err));
    }
  }

  /** Caminho de sempre: cabe numa requisição só. */
  private async singleRequest(
    points: LatLng[],
    perfil: RoutingProfileMapping,
    speedKmh: number,
  ): Promise<RouteMatrix> {
    const body = await this.fetchMatrix(points, perfil, points.length, points.length);
    if (body === 'no-route') return { ...allUnreachable(points.length), profile: perfil };

    // Geometria de reserva para as células a que falta um dos dois números.
    const reserva = haversineMatrix(points, speedKmh);
    const distanceKm: number[][] = [];
    const durationMin: number[][] = [];
    for (let i = 0; i < points.length; i++) {
      distanceKm.push([]);
      durationMin.push([]);
      for (let j = 0; j < points.length; j++) {
        const celula = normalizeCell(
          { meters: body.distances[i][j], seconds: body.durations[i][j] },
          { km: reserva.distanceKm[i][j], minutes: reserva.durationMin[i][j] },
        );
        distanceKm[i].push(celula.km);
        durationMin[i].push(celula.minutes);
      }
    }
    return { distanceKm, durationMin, source: 'provider', profile: perfil };
  }

  /**
   * Monta a matriz em ladrilhos de `BLOCK × BLOCK`.
   *
   * Cada requisição envia as coordenadas dos dois blocos concatenadas e usa
   * `sources`/`destinations` para pedir só o retângulo que interessa. O bloco
   * contra si mesmo manda as coordenadas uma vez só — repeti-las gastaria o
   * dobro do orçamento de 25 por nada.
   */
  private async tiled(
    points: LatLng[],
    perfil: RoutingProfileMapping,
    speedKmh: number,
  ): Promise<RouteMatrix> {
    const n = points.length;
    const reserva = haversineMatrix(points, speedKmh);
    const blocks = blocksOf(n);
    const distanceKm = emptyMatrix(n);
    const durationMin = emptyMatrix(n);

    const tarefas = blocks.flatMap((origens) =>
      blocks.map((destinos) => async () => {
        const mesmo = origens[0] === destinos[0];
        const coords = mesmo ? origens : [...origens, ...destinos];
        const sources = origens.map((_, k) => k);
        const destinations = mesmo
          ? destinos.map((_, k) => k)
          : destinos.map((_, k) => origens.length + k);

        const body = await this.fetchMatrix(
          coords.map((i) => points[i]),
          perfil,
          origens.length,
          destinos.length,
          { sources, destinations },
        );
        // `NoRoute` num ladrilho é afirmação sobre aquele retângulo: nenhum par
        // dali tem rota (ADR-0106). Não invalida os outros ladrilhos.
        for (let a = 0; a < origens.length; a++) {
          for (let b = 0; b < destinos.length; b++) {
            const [i, j] = [origens[a], destinos[b]];
            if (body === 'no-route') {
              distanceKm[i][j] = durationMin[i][j] = i === j ? 0 : UNREACHABLE;
            } else {
              const celula = normalizeCell(
                { meters: body.distances[a][b], seconds: body.durations[a][b] },
                { km: reserva.distanceKm[i][j], minutes: reserva.durationMin[i][j] },
              );
              distanceKm[i][j] = celula.km;
              durationMin[i][j] = celula.minutes;
            }
          }
        }
      }),
    );

    // Uma exceção aqui sobe e o `catch` do chamador devolve a matriz inteira
    // geométrica: nada de meia medida, meia estimativa.
    await inBatches(tarefas);
    return { distanceKm, durationMin, source: 'provider', profile: perfil };
  }

  /** `'no-route'` quando o provedor afirma que não há rota entre os pontos. */
  private async fetchMatrix(
    points: LatLng[],
    perfil: RoutingProfileMapping,
    rows: number,
    cols: number,
    scope?: { sources: number[]; destinations: number[] },
  ): Promise<'no-route' | { distances: (number | null)[][]; durations: (number | null)[][] }> {
    const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
    const params = new URLSearchParams({
      annotations: 'distance,duration',
      access_token: this.token!,
    });
    if (scope) {
      params.set('sources', scope.sources.join(';'));
      params.set('destinations', scope.destinations.join(';'));
    }

    const res = await fetch(
      `https://api.mapbox.com/directions-matrix/v1/mapbox/${perfil.profile}/${coords}?${params}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) {
      // O status entra na métrica; o corpo não é lido nem registado — pode
      // repetir a URL, e a URL leva o token.
      this.metrics.observeMatrixHttp(res.status);
      throw new Error(`HTTP ${res.status}`);
    }

    const body = (await res.json()) as MatrixResponse;
    // `NoRoute` é o provedor afirmando que **não existe rota** entre os pontos —
    // não é falha dele (ADR-0106). Degradar aqui devolveria distâncias em linha
    // reta sobre o oceano.
    if (body.code === 'NoRoute') return 'no-route';
    if (body.code !== 'Ok' || !body.distances || !body.durations) {
      throw new Error(`resposta inválida (${body.code ?? 'sem code'})`);
    }

    // A forma é verificada antes de qualquer leitura: uma linha curta lida com
    // `?.[b] ?? null` virava célula proibida, e o plano saía a contornar ruas
    // que existem (ADR-0126).
    assertMatrixShape(body.distances, rows, cols, 'distância');
    assertMatrixShape(body.durations, rows, cols, 'duração');
    assertFiniteCells(body.distances, 'distância');
    assertFiniteCells(body.durations, 'duração');

    return { distances: body.distances, durations: body.durations };
  }

  /**
   * Rede de proteção geométrica — **declarada**, nunca silenciosa.
   *
   * Com `MAPS_REQUIRE_PROVIDER=true` ela vira erro: quem contratou ETA medido
   * prefere não receber rota a receber uma rota que parece medida e não é.
   */
  private geometric(points: LatLng[], speedKmh: number, motivo: string, kind: string): RouteMatrix {
    this.metrics.observeMatrixFallback(kind);
    if (this.requireProvider) {
      throw new Error(
        `Roteamento real indisponível e MAPS_REQUIRE_PROVIDER está ativo: ${motivo}.`,
      );
    }
    if (!this.warned) {
      this.logger.warn(`Mapbox indisponível (${motivo}); usando Haversine.`);
      this.warned = true;
    }
    return haversineMatrix(points, speedKmh);
  }
}

/**
 * Mensagem segura para log.
 *
 * A URL do Matrix carrega `access_token` **e** as coordenadas de todas as
 * paradas — que são as moradas dos clientes. Alguns erros de rede trazem a URL
 * na mensagem, e um `logger.warn(err.message)` publicaria as duas coisas.
 * Aqui a mensagem é reduzida ao que ajuda a diagnosticar.
 */
function sanitize(err: unknown): string {
  const bruto = err instanceof Error ? err.message : String(err);
  if (/timeout|aborted|AbortError/i.test(bruto)) return `timeout de ${TIMEOUT_MS}ms`;
  const http = /HTTP (\d{3})/.exec(bruto);
  if (http) return `HTTP ${http[1]}`;
  // Corta qualquer coisa que se pareça com URL ou par de coordenadas.
  return bruto
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/-?\d{1,3}\.\d{3,},-?\d{1,3}\.\d{3,}/g, '[coord]')
    .slice(0, 200);
}

/** Categoria da falha, para a métrica. Fechada de propósito: sem cardinalidade. */
function kindOf(err: unknown): string {
  const bruto = err instanceof Error ? err.message : String(err);
  if (/timeout|aborted|AbortError/i.test(bruto)) return 'timeout';
  if (/HTTP \d{3}/.test(bruto)) return 'http-error';
  if (/matriz de/.test(bruto)) return 'invalid-matrix';
  if (/resposta inválida/.test(bruto)) return 'invalid-response';
  return 'error';
}

const emptyMatrix = (n: number): number[][] =>
  Array.from({ length: n }, () => new Array<number>(n).fill(UNREACHABLE));
