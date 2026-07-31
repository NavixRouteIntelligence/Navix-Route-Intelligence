import { bucketsFor, bucketsForHourOfWeek } from './cell-features';

/**
 * Risco de estouro de janela por parada (ADR-0091).
 *
 * ## O que estava faltando
 *
 * `analyzeDelays` (ADR-0025) já antecipava atraso, mas de forma **binária e
 * cega à incerteza**: só acusa a parada cuja chegada prevista já passou do fim
 * da janela. Uma parada prevista para chegar 5 minutos antes de fechar, numa
 * operação onde o ETA costuma errar 25 para mais, está em risco alto — e era
 * invisível.
 *
 * ## Como este estima
 *
 * Com o corpus da ADR-0087 sabemos **o quanto o nosso ETA erra** naquele
 * contexto. O risco é então a pergunta direta: em que fração das entregas
 * parecidas o atraso foi maior do que a folga que ainda resta?
 *
 * A estimativa é **empírica**, não paramétrica: nada de supor normalidade num
 * erro que sabidamente tem cauda longa (ADR-0090). Conta-se a proporção
 * observada, o que também a torna explicável em uma frase — "em 12 das 40
 * entregas parecidas o atraso passou da folga".
 */

/** Amostra mínima para afirmar risco. Abaixo disso, o silêncio é mais honesto. */
export const MIN_RISK_SAMPLE = 12;

export type BreachRiskLevel = 'low' | 'medium' | 'high';

/**
 * Limiares de probabilidade.
 *
 * Assimétricos de propósito: um alerta que não vem custa uma entrega estourada
 * sem aviso; um alerta a mais custa atenção. Como a ação de mitigação é barata
 * (reordenar, avisar o cliente), vale disparar antes da certeza — mas `high` só
 * acima de 60%, para o nível mais grave continuar significando alguma coisa.
 */
export const RISK_MEDIUM = 0.3;
export const RISK_HIGH = 0.6;

export interface BreachRisk {
  /** Probabilidade estimada de estourar a janela (0–1). */
  probability: number;
  level: BreachRiskLevel;
  /** Minutos entre a chegada prevista e o fim da janela. Negativo = já estourou. */
  slackMinutes: number;
  /** Observações que sustentam a estimativa. */
  samples: number;
}

/** Erro observado de uma entrega passada, com o contexto em que ocorreu. */
export interface ErrorSample {
  /** real − previsto, em minutos (ADR-0087). Positivo = atrasou. */
  errorMinutes: number;
  hourOfWeek: number;
}

function levelOf(probability: number): BreachRiskLevel {
  if (probability >= RISK_HIGH) return 'high';
  if (probability >= RISK_MEDIUM) return 'medium';
  return 'low';
}

/**
 * Erros históricos do contexto de um instante, pela mesma cascata das features
 * (ADR-0089): o balde mais específico que tenha amostra suficiente.
 *
 * Devolve `null` quando nem o balde global chega à amostra mínima — e nulo
 * significa "não sei", que é diferente de "não há risco".
 */
export function errorsForContext(samples: ErrorSample[], at: Date): number[] | null {
  const porBucket = new Map<string, number[]>();
  for (const sample of samples) {
    for (const bucket of bucketsForHourOfWeek(sample.hourOfWeek)) {
      const lista = porBucket.get(bucket);
      if (lista) lista.push(sample.errorMinutes);
      else porBucket.set(bucket, [sample.errorMinutes]);
    }
  }

  for (const bucket of bucketsFor(at)) {
    const erros = porBucket.get(bucket);
    if (erros && erros.length >= MIN_RISK_SAMPLE) return erros;
  }
  return null;
}

/**
 * Estima o risco de a parada estourar a janela.
 *
 * `null` quando não há histórico suficiente: sem base, afirmar "risco baixo"
 * seria inventar uma garantia — e é justamente no começo, quando o corpus é
 * pequeno, que um falso "está tudo bem" faria mais estrago.
 */
export function estimateBreachRisk(
  predictedArrival: Date,
  windowEnd: Date,
  errors: number[] | null,
): BreachRisk | null {
  if (!errors || errors.length < MIN_RISK_SAMPLE) return null;

  const slackMinutes = Math.round(((windowEnd.getTime() - predictedArrival.getTime()) / 60_000) * 10) / 10;

  // A previsão já estourou a janela: não é mais estimativa, é constatação. O
  // histórico não muda um fato que já aconteceu no cronograma.
  if (slackMinutes < 0) {
    return { probability: 1, level: 'high', slackMinutes, samples: errors.length };
  }

  const excedem = errors.filter((e) => e > slackMinutes).length;
  const probability = Math.round((excedem / errors.length) * 100) / 100;

  return { probability, level: levelOf(probability), slackMinutes, samples: errors.length };
}
