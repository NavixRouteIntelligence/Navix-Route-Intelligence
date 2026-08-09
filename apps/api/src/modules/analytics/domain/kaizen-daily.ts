import type { DriverDailySnapshot } from '@navix/contracts';

import type { Indicator, PersonalBaseline, Trend } from './driver-baseline';

/**
 * O resumo diário como a app o lê (ADR-0120).
 *
 * Camada de **apresentação do domínio**: não calcula métrica nenhuma nova, e
 * por isso é pura e determinística. O que faz é responder à pergunta que a
 * fotografia sozinha não responde — *quanto disto se pode acreditar, e porquê*
 * — e recortar o que sai para fora.
 */

/** Diferença face à própria referência. `null` quando não há o que comparar. */
export interface Delta {
  absolute: number | null;
  /** Fração (0,25 = +25%). `null` quando a referência é zero ou ausente. */
  relative: number | null;
  trend: Trend;
}

export interface KaizenHighlight {
  metric: 'delivered' | 'successRate' | 'onTimeRate' | 'activeMinutes';
  trend: Trend;
  /** `true` quando o indicador só informa e não gera ação (ADR-0118). */
  informative: boolean;
}

export type Confidence = 'high' | 'medium' | 'low';

/**
 * Por que a confiança não é alta. Códigos, não prosa — o texto é da app.
 *
 * A lista existir vazia é significativo: significa que nada foi omitido nem
 * aproximado. Uma confiança alta sem razões é diferente de uma confiança alta
 * que "esqueceu" de listar as suas ressalvas.
 */
export type ConfidenceReason =
  'projection-pending' | 'activity-unknown' | 'short-history' | 'no-work';

/** No máximo dois destaques: uma lista de seis destaques não destaca nada. */
export const MAX_HIGHLIGHTS = 2;

/** Dias trabalhados abaixo dos quais a comparação ainda é frágil. */
export const SHORT_HISTORY_SAMPLE = 5;

export function deltaOf(indicator: Indicator): Delta {
  const { current, baseline, trend } = indicator;
  if (current === null || baseline === null) {
    return { absolute: null, relative: null, trend };
  }
  const absolute = current - baseline;
  return {
    absolute,
    // Referência zero não tem variação relativa: dividir por ela produziria
    // infinito, e arredondá-lo para 100% seria inventar uma escala.
    relative: baseline === 0 ? null : absolute / baseline,
    trend,
  };
}

/**
 * Os indicadores que saíram do habitual, no máximo [MAX_HIGHLIGHTS].
 *
 * A ordem é a mesma da prioridade do motor: descanso primeiro. Um dia longo
 * importa mais do que um bom número de entregas, mesmo quando os dois mudaram.
 */
export function highlightsOf(baseline: PersonalBaseline): KaizenHighlight[] {
  const candidatos: KaizenHighlight[] = [
    { metric: 'activeMinutes', ...marca(baseline.activeMinutes) },
    { metric: 'delivered', ...marca(baseline.delivered) },
    { metric: 'successRate', ...marca(baseline.successRate) },
    { metric: 'onTimeRate', ...marca(baseline.onTimeRate) },
  ];

  return candidatos
    .filter((h) => h.trend === 'improved' || h.trend === 'attention')
    .slice(0, MAX_HIGHLIGHTS);
}

function marca(indicator: Indicator): { trend: Trend; informative: boolean } {
  return { trend: indicator.trend, informative: indicator.informative === true };
}

/**
 * Quanto se pode acreditar neste resumo, e porquê (ADR-0120).
 *
 * A confiança não mede a qualidade do trabalho de quem dirige — mede a
 * qualidade **do dado**. É uma distinção que precisa de estar no nome e no
 * texto da app: "confiança baixa" nunca pode ser lido como juízo sobre o dia.
 */
export function confidenceOf(
  snapshot: DriverDailySnapshot,
  baseline: PersonalBaseline | null,
): { confidence: Confidence; reasons: ConfidenceReason[] } {
  const reasons: ConfidenceReason[] = [];

  if (snapshot.state === 'pending') reasons.push('projection-pending');
  if (snapshot.state === 'no-work') reasons.push('no-work');
  if (snapshot.state === 'incomplete' || snapshot.activeMinutes === null) {
    reasons.push('activity-unknown');
  }
  const amostra = baseline?.delivered.sample ?? 0;
  if (amostra < SHORT_HISTORY_SAMPLE) reasons.push('short-history');

  // Projeção pendente é ausência de dado, não dado fraco: nada do que está no
  // ecrã foi lido do read model, e chamar-lhe "média" seria generoso demais.
  if (snapshot.state === 'pending') return { confidence: 'low', reasons };
  if (reasons.length === 0) return { confidence: 'high', reasons };
  return { confidence: reasons.length >= 2 ? 'low' : 'medium', reasons };
}
