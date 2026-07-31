/**
 * Como o instante real de chegada foi obtido. Fontes diferentes têm qualidades
 * de sinal diferentes e não devem ser misturadas na mesma média sem que se
 * saiba a proporção.
 */
export type EtaActualSource = 'status_change' | 'pod';

/** Uma medição do erro de ETA — e, ao mesmo tempo, um exemplo rotulado. */
export interface EtaObservation {
  id: string;
  tenantId: string;
  deliveryId: string;
  routePlanId: string | null;
  predictedArrivalAt: Date | null;
  actualArrivalAt: Date;
  /** real − previsto, em minutos. Positivo = chegou depois do prometido. */
  errorMinutes: number | null;
  /**
   * Correção do modelo já embutida em `predictedArrivalAt` (ADR-0090). Zero
   * quando a previsão é a heurística crua. Guardada para que o treino seguinte
   * recupere o resíduo do baseline e não corrija a própria correção.
   */
  correctionMinutes: number;
  source: EtaActualSource;
  cell: string;
  hourOfWeek: number;
  createdAt: Date;
}

/**
 * Erro com **sinal**, em minutos: real − previsto.
 *
 * O sinal é o que separa erro de viés. Um ETA que atrasa sempre 10 minutos é
 * um problema diferente de um que oscila ±10: o primeiro se corrige com uma
 * constante, o segundo exige modelo. Uma média de valores absolutos esconderia
 * exatamente essa diferença.
 */
export function errorMinutes(predicted: Date | null, actual: Date): number | null {
  if (!predicted) return null;
  return round((actual.getTime() - predicted.getTime()) / 60_000);
}

/**
 * Hora da semana (0 = domingo 00h … 167 = sábado 23h).
 *
 * É a granularidade em que o trânsito de fato varia — hora do dia sozinha
 * mistura terça-feira de manhã com domingo de manhã, que não se parecem. É
 * também exatamente o eixo que a heurística atual usa (ADR-0025), o que torna a
 * comparação direta.
 */
export function hourOfWeek(at: Date): number {
  return at.getDay() * 24 + at.getHours();
}

/** Resumo estatístico de um conjunto de medições. */
export interface EtaQualitySummary {
  /** Medições com previsão disponível (as sem previsão não entram na média). */
  samples: number;
  /** Erro absoluto médio, em minutos. `null` sem amostra. */
  maeMinutes: number | null;
  /** Erro médio com sinal: positivo = o ETA promete cedo demais. */
  biasMinutes: number | null;
  /** Erro absoluto no percentil 90 — a cauda que o cliente sente. */
  p90Minutes: number | null;
  /** Medições sem previsão (entrega concluída sem plano vigente). */
  withoutPrediction: number;
}

/**
 * Agrega medições em MAE, viés e p90.
 *
 * Puro e determinístico: é o número que decide se um modelo entra ou não em
 * produção, então precisa ser reproduzível fora de qualquer infraestrutura.
 */
export function summarize(errors: (number | null)[]): EtaQualitySummary {
  const withPrediction = errors.filter((e): e is number => e !== null);
  const withoutPrediction = errors.length - withPrediction.length;

  if (withPrediction.length === 0) {
    return {
      samples: 0,
      maeMinutes: null,
      biasMinutes: null,
      p90Minutes: null,
      withoutPrediction,
    };
  }

  const absolutes = withPrediction.map(Math.abs).sort((a, b) => a - b);
  const sum = (values: number[]): number => values.reduce((acc, v) => acc + v, 0);

  return {
    samples: withPrediction.length,
    maeMinutes: round(sum(absolutes) / absolutes.length),
    biasMinutes: round(sum(withPrediction) / withPrediction.length),
    p90Minutes: round(percentile(absolutes, 0.9)),
    withoutPrediction,
  };
}

/** Percentil por interpolação linear sobre a lista **já ordenada**. */
function percentile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (pos - low);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
