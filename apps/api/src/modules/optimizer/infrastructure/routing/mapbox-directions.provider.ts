import { Injectable, Logger } from '@nestjs/common';
import type { VehicleType } from '@navix/contracts';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type { LatLng } from '../../../../shared/kernel/geo';
import { decodePolyline6, joinSegments, type LineCoordinate } from '../../domain/polyline';
import type {
  RouteGeometry,
  RouteGeometryProviderPort,
} from '../../domain/ports/route-geometry.port';
import { resolveRoutingProfile } from '../../domain/routing-profile';
import { OptimizerMetrics } from '../observability/optimizer-metrics';

/**
 * Máximo de coordenadas por pedido à Directions API.
 *
 * É limite do provedor, não escolha nossa. Uma rota com mais paradas é pedida
 * aos bocados e as linhas são coladas.
 */
const MAX_COORDS_PER_REQUEST = 25;

/**
 * Teto de troços por rota.
 *
 * Cada troço é um pedido pago. Uma rota que precise de mais do que isto tem
 * mais de 350 paradas — não existe numa jornada, e se existir é melhor não ter
 * traçado do que emitir dezenas de pedidos por cada abertura da tela.
 */
const MAX_SEGMENTS = 15;

const TIMEOUT_MS = 4000;

/**
 * `overview=simplified` e não `full`.
 *
 * `full` devolve todos os vértices que o motor de rotas conhece — numa rota
 * urbana de 30 km são milhares de pontos, e essa linha viaja para o telemóvel a
 * **cada** recarregamento da rota: depois de cada entrega registada, de cada
 * puxar-para-atualizar. Em dados móveis isso é caro para quem trabalha na rua.
 *
 * `simplified` é a mesma linha pelas mesmas ruas, com os vértices que não mudam
 * o desenho removidos. Ao zoom de rua chega a notar-se um canto cortado; quem
 * precisa de detalhe curva-a-curva usa a navegação externa, que é onde a
 * ADR-0125 a deixou de propósito.
 */
const OVERVIEW = 'simplified';

interface DirectionsResponse {
  code?: string;
  routes?: { geometry?: string }[];
}

/**
 * Traçado real pela Mapbox Directions API (ADR-0131).
 *
 * Corre **depois** de a ordem estar decidida e nunca alimenta o otimizador —
 * ver [RouteGeometryProviderPort] para porque é um port separado do da matriz.
 */
@Injectable()
export class MapboxDirectionsProvider implements RouteGeometryProviderPort {
  private readonly logger = new Logger('MapboxDirections');
  private readonly token: string | undefined;
  private warned = false;

  constructor(
    config: AppConfigService,
    private readonly metrics: OptimizerMetrics,
  ) {
    this.token = config.maps.mapboxToken;
  }

  async geometry(
    points: LatLng[],
    vehicleType?: VehicleType | null,
  ): Promise<RouteGeometry | null> {
    // Uma parada só não tem traçado, e zero paradas muito menos.
    if (points.length < 2) return null;

    if (!this.token) {
      if (!this.warned) {
        this.logger.warn('Sem token da Mapbox; a rota fica sem traçado.');
        this.warned = true;
      }
      this.metrics.observeGeometry('no-token');
      return null;
    }

    const perfil = resolveRoutingProfile(vehicleType);
    const troços = chunkPoints(points);

    if (troços.length > MAX_SEGMENTS) {
      this.metrics.observeGeometry('too-many-stops');
      return null;
    }

    try {
      const linhas: LineCoordinate[][] = [];
      // Em série, e não em paralelo. O traçado não está no caminho crítico de
      // nada — é uma linha num mapa —, e disparar quinze pedidos ao mesmo tempo
      // por cada abertura da tela é a forma mais rápida de bater no limite de
      // pedidos por minuto da conta e passar a não ter traçado nenhum.
      for (const troço of troços) {
        const linha = await this.fetchSegment(troço, perfil.profile);
        // Um troço em falta deixa um buraco no meio da rota. Colar o que sobra
        // desenharia um salto entre ruas distantes, que se lê como um percurso
        // que ninguém vai fazer.
        if (linha === null) {
          this.metrics.observeGeometry('partial');
          return null;
        }
        linhas.push(linha);
      }

      this.metrics.observeGeometry('ok');
      return {
        coordinates: joinSegments(linhas),
        profile: perfil.profile,
        coveredStops: points.length,
      };
    } catch (err) {
      this.metrics.observeGeometry(kindOf(err));
      this.logger.warn(`Traçado indisponível (${sanitize(err)}); a rota fica só com os pontos.`);
      return null;
    }
  }

  private async fetchSegment(points: LatLng[], profile: string): Promise<LineCoordinate[] | null> {
    const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
    const params = new URLSearchParams({
      geometries: 'polyline6',
      overview: OVERVIEW,
      // Sem passos, sem alternativas, sem anotações: nada disto se desenha, e
      // tudo isto se paga em bytes.
      steps: 'false',
      alternatives: 'false',
      access_token: this.token!,
    });

    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?${params}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) {
      // O corpo não é lido nem registado: pode repetir a URL, e a URL leva o
      // token e as moradas dos clientes.
      this.metrics.observeGeometryHttp(res.status);
      throw new Error(`HTTP ${res.status}`);
    }

    const body = (await res.json()) as DirectionsResponse;
    // `NoRoute` é o provedor a afirmar que não há caminho entre estes pontos —
    // não é falha dele, e não há linha a desenhar.
    if (body.code === 'NoRoute' || body.code === 'NoSegment') return null;
    if (body.code !== 'Ok') throw new Error(`resposta inválida (${body.code ?? 'sem code'})`);

    const encoded = body.routes?.[0]?.geometry;
    if (typeof encoded !== 'string') return null;

    return decodePolyline6(encoded);
  }
}

/**
 * Parte a sequência em troços que cabem num pedido, **repetindo o ponto de
 * junção**.
 *
 * Sem a repetição, o troço seguinte começaria na parada a seguir e o traçado
 * teria um buraco exatamente entre elas — o pedaço mais fácil de não notar,
 * porque a linha continua e só falta um quarteirão.
 */
export function chunkPoints(points: LatLng[]): LatLng[][] {
  if (points.length <= MAX_COORDS_PER_REQUEST) return [points];

  const troços: LatLng[][] = [];
  let inicio = 0;
  while (inicio < points.length - 1) {
    const fim = Math.min(inicio + MAX_COORDS_PER_REQUEST, points.length);
    troços.push(points.slice(inicio, fim));
    inicio = fim - 1;
  }
  return troços;
}

/** Mensagem segura para log — a URL leva o token e as moradas. */
function sanitize(err: unknown): string {
  const bruto = err instanceof Error ? err.message : String(err);
  if (/timeout|aborted|AbortError/i.test(bruto)) return `timeout de ${TIMEOUT_MS}ms`;
  const http = /HTTP (\d{3})/.exec(bruto);
  if (http) return `HTTP ${http[1]}`;
  return bruto
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/-?\d{1,3}\.\d{3,},-?\d{1,3}\.\d{3,}/g, '[coord]')
    .slice(0, 200);
}

/** Categoria da falha, para a métrica. Fechada de propósito. */
function kindOf(err: unknown): string {
  const bruto = err instanceof Error ? err.message : String(err);
  if (/timeout|aborted|AbortError/i.test(bruto)) return 'timeout';
  if (/HTTP \d{3}/.test(bruto)) return 'http-error';
  if (/resposta inválida/.test(bruto)) return 'invalid-response';
  return 'error';
}
