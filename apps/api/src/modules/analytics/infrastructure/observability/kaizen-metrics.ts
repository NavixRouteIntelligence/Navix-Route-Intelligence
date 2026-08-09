import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

import { MetricsService } from '../../../../observability/metrics/metrics.service';

/**
 * Métricas técnicas do Kaizen (ADR-0123), no Registry compartilhado (ADR-0021).
 *
 * ## Sem PII, por construção
 *
 * Nenhum rótulo carrega id de utilizador, de tenant, e-mail ou qualquer número
 * do dia de alguém. Os rótulos são **categorias fechadas** — estado, confiança,
 * código de regra, veredito — e é isso que impede a cardinalidade de explodir e,
 * mais importante, que o painel de observabilidade vire um espelho de quem
 * entregou o quê. Quem precisa do dado de uma pessoa consulta a API dela, com
 * autenticação; o Prometheus responde sobre o **sistema**.
 *
 * ## Por que a idade do dado é a métrica que mais importa
 *
 * Um resumo servido não diz nada sobre estar certo. A pergunta operacional é
 * «há quanto tempo isto foi projetado?» — porque a falha desta frente não é o
 * endpoint cair, é ele responder depressa com o dia de anteontem.
 */
@Injectable()
export class KaizenMetrics {
  private readonly served: Counter<'state' | 'confidence'>;
  private readonly dataAge: Histogram<'state'>;
  private readonly rule: Counter<'code' | 'suppressed'>;
  private readonly feedback: Counter<'verdict' | 'reason'>;
  private readonly errors: Counter<'stage'>;

  constructor(metrics: MetricsService) {
    const registers = [metrics.registry];

    this.served = new Counter({
      name: 'kaizen_summary_served_total',
      help: 'Resumos diários servidos, por estado do dia e confiança do dado.',
      labelNames: ['state', 'confidence'] as const,
      registers,
    });

    this.dataAge = new Histogram({
      name: 'kaizen_data_age_seconds',
      help: 'Idade da projeção que sustentou o resumo servido.',
      labelNames: ['state'] as const,
      // De minutos a dois dias: o que interessa distinguir é «fresco»,
      // «atrasado» e «parado», não a precisão do segundo.
      buckets: [60, 300, 900, 3600, 6 * 3600, 12 * 3600, 24 * 3600, 48 * 3600],
      registers,
    });

    this.rule = new Counter({
      name: 'kaizen_recommendation_total',
      help: 'Regra escolhida pelo motor, e se foi silenciada pela relevância.',
      labelNames: ['code', 'suppressed'] as const,
      registers,
    });

    this.feedback = new Counter({
      name: 'kaizen_feedback_total',
      help: 'Feedback recebido, agregado por veredito e motivo.',
      labelNames: ['verdict', 'reason'] as const,
      registers,
    });

    this.errors = new Counter({
      name: 'kaizen_errors_total',
      help: 'Falhas por etapa (projeção, leitura, feedback).',
      labelNames: ['stage'] as const,
      registers,
    });
  }

  /** Um resumo entregue. `ageSeconds` ausente quando não houve projeção. */
  observeServed(state: string, confidence: string, ageSeconds: number | null): void {
    this.served.inc({ state, confidence });
    if (ageSeconds !== null && ageSeconds >= 0) this.dataAge.observe({ state }, ageSeconds);
  }

  /** `suppressed` é o motivo do silêncio, ou `no` quando a sugestão apareceu. */
  observeRule(code: string, suppressed: string): void {
    this.rule.inc({ code, suppressed });
  }

  /** `reason` só existe em «não se aplica»; ausente vira `none`. */
  observeFeedback(verdict: string, reason: string | null): void {
    this.feedback.inc({ verdict, reason: reason ?? 'none' });
  }

  observeError(stage: 'projection' | 'read' | 'feedback'): void {
    this.errors.inc({ stage });
  }
}
