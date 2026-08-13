import { Injectable } from '@nestjs/common';
import { Counter } from 'prom-client';

import { MetricsService } from '../../../../observability/metrics/metrics.service';

/**
 * Métricas da geocodificação (ADR-0133), no Registry partilhado.
 *
 * Existem porque, sem elas, a única forma de saber que a geocodificação piorou
 * era um motorista ligar a dizer que a morada estava errada. Os rótulos são um
 * conjunto **fechado** — nunca a morada, nunca o tenant: uma métrica com
 * cardinalidade de cliente é um vazamento com outro nome, e além disso derruba
 * o Prometheus.
 */
@Injectable()
export class GeocodingMetrics {
  private readonly outcome: Counter<'outcome'>;
  private readonly http: Counter<'status'>;

  constructor(metrics: MetricsService) {
    const registers = [metrics.registry];
    this.outcome = new Counter({
      name: 'import_geocoding_total',
      help: 'Geocodificações por desfecho (ok, needs-review, no-result, erros).',
      labelNames: ['outcome'] as const,
      registers,
    });
    this.http = new Counter({
      name: 'import_geocoding_http_errors_total',
      help: 'Respostas HTTP não-OK do geocodificador, por status.',
      labelNames: ['status'] as const,
      registers,
    });
  }

  /** `outcome` vem de um conjunto fechado no adaptador. */
  observe(outcome: string): void {
    this.outcome.inc({ outcome });
  }

  observeHttp(status: number): void {
    this.http.inc({ status: String(status) });
  }
}
