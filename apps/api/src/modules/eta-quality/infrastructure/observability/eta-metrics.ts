import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

import { MetricsService } from '../../../../observability/metrics/metrics.service';

/**
 * Qualidade do ETA (ADR-0087), no Registry compartilhado do `MetricsService`
 * (ADR-0021) e exposta em `/metrics`.
 *
 * O histograma de erro **absoluto** é o que dá o MAE em Prometheus:
 * `rate(eta_absolute_error_minutes_sum[1d]) / rate(eta_absolute_error_minutes_count[1d])`.
 * O erro **com sinal** vai à parte porque responde outra pergunta — se o ETA
 * promete cedo ou tarde demais —, e uma média de absolutos apagaria isso.
 */
@Injectable()
export class EtaMetrics {
  private readonly absoluteError: Histogram<string>;
  private readonly signedError: Histogram<string>;
  private readonly withoutPrediction: Counter<string>;

  constructor(metrics: MetricsService) {
    const registers = [metrics.registry];
    // Buckets em minutos: a resolução fina embaixo é onde a decisão mora (um
    // ETA com 5 min de erro é útil; com 60, é ruído).
    const buckets = [1, 2, 3, 5, 8, 13, 21, 34, 60, 120];

    this.absoluteError = new Histogram({
      name: 'eta_absolute_error_minutes',
      help: 'Erro absoluto do ETA na conclusão da entrega (minutos). MAE = sum/count.',
      buckets,
      registers,
    });
    this.signedError = new Histogram({
      name: 'eta_signed_error_minutes',
      help: 'Erro do ETA com sinal (minutos). Positivo = chegou depois do previsto.',
      buckets: [-120, -60, -30, -15, -5, 0, 5, 15, 30, 60, 120],
      registers,
    });
    this.withoutPrediction = new Counter({
      name: 'eta_observations_without_prediction_total',
      help: 'Entregas concluídas sem plano vigente — medidas, mas fora da média.',
      registers,
    });
  }

  /** Registra uma medição. `null` = concluída sem previsão a comparar. */
  record(errorMinutes: number | null): void {
    if (errorMinutes === null) {
      this.withoutPrediction.inc();
      return;
    }
    this.absoluteError.observe(Math.abs(errorMinutes));
    this.signedError.observe(errorMinutes);
  }
}
