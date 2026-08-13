import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import {
  needsReview,
  reviewReason,
  type GeocodeAccuracy,
  type GeocodeConfidence,
} from '../../domain/geocode-quality';
import type {
  GeocodeOptions,
  GeocoderPort,
  GeocodeResult,
} from '../../domain/ports/geocoder.port';
import { GeocodingMetrics } from './geocoding-metrics';

/** Timeout por chamada. Uma importação de 500 linhas não pode ficar pendurada. */
const TIMEOUT_MS = 5000;

/**
 * Chamadas em voo ao mesmo tempo.
 *
 * A geocodificação temporária da Mapbox permite ~600 pedidos por minuto. Uma
 * importação de 500 linhas em paralelo esgota isso em segundos e passa a
 * receber `429` — e o resultado de um `429` é uma linha sem coordenadas, ou
 * seja, uma entrega perdida por pressa. Seis em voo com o espaçamento abaixo
 * mantém-nos folgadamente dentro do limite.
 */
const CONCURRENCY = 6;

/** Intervalo mínimo entre chamadas, por processo. 600/min = uma a cada 100 ms. */
const MIN_INTERVAL_MS = 100;

/** Estrutura da resposta v6. Só o que se lê. */
interface V6Feature {
  properties?: {
    feature_type?: string;
    coordinates?: {
      longitude?: number;
      latitude?: number;
      accuracy?: string;
    };
    match_code?: { confidence?: string };
    context?: {
      address?: { name?: string; address_number?: string; street_name?: string };
      street?: { name?: string };
      postcode?: { name?: string };
      place?: { name?: string };
      region?: { name?: string; region_code?: string };
      country?: { country_code?: string };
    };
  };
  geometry?: { coordinates?: [number, number] };
}

/**
 * Geocodificação pela **Forward Geocoding v6** da Mapbox (ADR-0133).
 *
 * ## O que a v6 traz que a v5 não tinha
 *
 * A v5 devolvia um resultado e mais nada sobre ele. Este adaptador aceitava o
 * primeiro, sempre — e «Rua Alfa», sem número, devolve o centro de uma
 * freguesia com coordenadas válidas, que entravam na rota como qualquer morada.
 * A v6 diz **quão bem** casou e **como** obteve a coordenada, e é isso que
 * permite mandar o duvidoso para revisão em vez de o aceitar.
 *
 * ## Sobre o que **não** vai para o log
 *
 * Nem a morada, nem a URL, nem o corpo da resposta. A morada é a casa de um
 * cliente; a URL leva o `access_token` e a morada dentro dela; e o corpo de um
 * erro da Mapbox costuma repetir a consulta. A versão anterior registava os
 * três — `Mapbox sem resultados para: ${address}` era uma linha de log por
 * cliente, e `Falha na geocodificação: ${error.message}` publicava a URL
 * inteira sempre que a falha era de rede.
 */
@Injectable()
export class MapboxGeocoder implements GeocoderPort {
  private readonly logger = new Logger(MapboxGeocoder.name);
  private avisouSemToken = false;

  /** Fila do limitador: quantas chamadas estão em voo e quando foi a última. */
  private emVoo = 0;
  private ultimaChamada = 0;

  constructor(
    private readonly config: AppConfigService,
    private readonly metrics: GeocodingMetrics,
  ) {}

  async geocode(address: string, options: GeocodeOptions = {}): Promise<GeocodeResult | null> {
    const token = this.config.mapboxToken;
    if (!token) {
      if (!this.avisouSemToken) {
        this.logger.warn('MAPBOX_TOKEN ausente — geocodificação desativada.');
        this.avisouSemToken = true;
      }
      this.metrics.observe('no-token');
      return null;
    }
    if (!address.trim()) return null;

    const params = new URLSearchParams({
      q: address,
      limit: '1',
      // Sem sugestões parciais: isto não é uma caixa de pesquisa, é uma morada
      // completa que se resolve de uma vez.
      autocomplete: 'false',
      language: options.language ?? 'pt',
      access_token: token,
    });
    // Sem país configurado não se filtra: filtrar por um palpite devolveria a
    // morada mais parecida no país errado, com coordenadas plausíveis.
    if (options.country) params.set('country', options.country);

    try {
      const res = await this.limitado(() =>
        fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }),
      );

      if (!res.ok) {
        // O status entra na métrica; o corpo não é lido — pode repetir a
        // consulta, que é a morada de um cliente.
        this.metrics.observeHttp(res.status);
        this.metrics.observe('http-error');
        return null;
      }

      const data = (await res.json()) as { features?: V6Feature[] };
      const feature = data.features?.[0];
      if (!feature) {
        // Sem a morada no texto: «não encontrou» é a informação; **qual**
        // morada não encontrou é dado do cliente.
        this.metrics.observe('no-result');
        return null;
      }

      const resultado = toResult(feature);
      if (!resultado) {
        this.metrics.observe('invalid-response');
        return null;
      }

      this.metrics.observe(resultado.needsReview ? 'needs-review' : 'ok');
      return resultado;
    } catch (err) {
      this.metrics.observe(kindOf(err));
      this.logger.warn(`Falha na geocodificação: ${sanitize(err)}`);
      return null;
    }
  }

  /**
   * Segura a mão no limite de taxa: no máximo [CONCURRENCY] em voo e uma
   * chamada a cada [MIN_INTERVAL_MS].
   *
   * Deliberadamente por processo e sem estado partilhado. Um limitador
   * distribuído seria mais correto com várias instâncias, e seria também mais
   * uma dependência no caminho de uma importação — o espaçamento aqui já põe
   * uma instância a menos de metade do limite da conta.
   */
  private async limitado<T>(run: () => Promise<T>): Promise<T> {
    while (this.emVoo >= CONCURRENCY) {
      await esperar(MIN_INTERVAL_MS);
    }
    const desde = Date.now() - this.ultimaChamada;
    if (desde < MIN_INTERVAL_MS) await esperar(MIN_INTERVAL_MS - desde);

    this.emVoo += 1;
    this.ultimaChamada = Date.now();
    try {
      return await run();
    } finally {
      this.emVoo -= 1;
    }
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Traduz uma feature da v6, ou devolve `null` quando ela não tem coordenada
 * utilizável.
 *
 * A coordenada é lida de `properties.coordinates` e, em falta, da `geometry` —
 * as duas existem na v6 e nem sempre ambas vêm preenchidas. Uma coordenada
 * fora do planeta é recusada em vez de propagada: um pino impossível faz a
 * câmara do mapa enquadrar meio globo.
 */
export function toResult(feature: V6Feature): GeocodeResult | null {
  const props = feature.properties ?? {};
  const coords = props.coordinates ?? {};
  const longitude = coords.longitude ?? feature.geometry?.coordinates?.[0];
  const latitude = coords.latitude ?? feature.geometry?.coordinates?.[1];

  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const ctx = props.context ?? {};
  const confidence = normalizeConfidence(props.match_code?.confidence);
  const accuracy = normalizeAccuracy(coords.accuracy);
  const featureType = props.feature_type ?? 'unknown';
  const qualidade = { confidence, accuracy, featureType };

  return {
    latitude,
    longitude,
    street: ctx.address?.street_name ?? ctx.street?.name,
    number: ctx.address?.address_number,
    city: ctx.place?.name,
    // `region_code` da v6 já vem sem o prefixo do país (`SP`, e não `BR-SP`),
    // ao contrário do `short_code` da v5, que obrigava a cortar o prefixo à mão.
    state: ctx.region?.region_code ?? ctx.region?.name,
    postalCode: ctx.postcode?.name,
    country: ctx.country?.country_code?.toUpperCase(),
    confidence,
    accuracy,
    needsReview: needsReview(qualidade),
    reviewReason: reviewReason(qualidade),
  };
}

const CONFIANCAS: ReadonlySet<string> = new Set(['exact', 'high', 'medium', 'low']);
const PRECISOES: ReadonlySet<string> = new Set([
  'rooftop',
  'parcel',
  'point',
  'interpolated',
  'intersection',
  'street',
  'approximate',
]);

/** Um valor que não conhecemos vira `unknown`, e `unknown` conta como fraco. */
function normalizeConfidence(raw?: string): GeocodeConfidence {
  return CONFIANCAS.has(raw ?? '') ? (raw as GeocodeConfidence) : 'unknown';
}

function normalizeAccuracy(raw?: string): GeocodeAccuracy {
  return PRECISOES.has(raw ?? '') ? (raw as GeocodeAccuracy) : 'unknown';
}

/**
 * Mensagem segura para log.
 *
 * A URL da geocodificação leva o `access_token` **e** a morada do cliente.
 * Alguns erros de rede trazem a URL na mensagem, e um `logger.warn(err.message)`
 * publicaria as duas coisas — que é o que a versão anterior fazia.
 */
export function sanitize(err: unknown): string {
  const bruto = err instanceof Error ? err.message : String(err);
  if (/timeout|aborted|AbortError/i.test(bruto)) return `timeout de ${TIMEOUT_MS}ms`;
  const http = /HTTP (\d{3})/.exec(bruto);
  if (http) return `HTTP ${http[1]}`;
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
  return 'error';
}
