/**
 * KPIs derivados do read model diário (ADR-0092).
 *
 * Puro e determinístico: é o número que a empresa olha para decidir, então
 * precisa ser reproduzível fora de qualquer infraestrutura — e testável sem
 * banco.
 */

/** Uma linha do rollup: contagens cruas de um dia. */
export interface KpiDailyRow {
  day: string;
  plans: number;
  savedKm: number;
  savedMinutes: number;
  optimizedKm: number;
  baselineKm: number;
  scoreSum: number;
  delivered: number;
  failed: number;
  canceled: number;
  onTime: number;
  expense: number;
}

/** Ponto da série para o gráfico — já com as taxas do dia. */
export interface KpiPoint {
  day: string;
  savedKm: number;
  delivered: number;
  successRate: number | null;
  onTimeRate: number | null;
}

export interface KpiSummary {
  from: string;
  to: string;
  /** Quilômetros poupados pela otimização no período. */
  savedKm: number;
  savedMinutes: number;
  optimizedKm: number;
  /** Economia de distância agregada: km poupados ÷ km da baseline. */
  distanceSavingsRate: number | null;
  /** Score médio das rotas, ponderado pelo nº de planos. `null` sem planos. */
  averageScore: number | null;
  delivered: number;
  /** Entregas que chegaram a um estado final (entregue, falhou ou cancelada). */
  finished: number;
  /** Entregues ÷ finalizadas. `null` sem nenhuma finalizada. */
  successRate: number | null;
  /** Entregues no prazo ÷ entregues. `null` sem entregas concluídas. */
  onTimeRate: number | null;
  /** Despesa ÷ entregues. `null` sem entregas concluídas. */
  costPerDelivery: number | null;
  series: KpiPoint[];
}

const round = (n: number, casas = 2): number => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

/**
 * Razão segura: `null` quando não há denominador.
 *
 * Zero seria mentira — "0% de sucesso" e "nenhuma entrega ainda" são estados
 * diferentes, e só o segundo é verdade num tenant que acabou de começar.
 */
function rate(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return round(numerador / denominador, 4);
}

/** Agrega as linhas do rollup no resumo do período. */
export function summarizeKpis(rows: KpiDailyRow[], from: string, to: string): KpiSummary {
  const total = rows.reduce(
    (acc, r) => ({
      plans: acc.plans + r.plans,
      savedKm: acc.savedKm + r.savedKm,
      savedMinutes: acc.savedMinutes + r.savedMinutes,
      optimizedKm: acc.optimizedKm + r.optimizedKm,
      baselineKm: acc.baselineKm + r.baselineKm,
      scoreSum: acc.scoreSum + r.scoreSum,
      delivered: acc.delivered + r.delivered,
      failed: acc.failed + r.failed,
      canceled: acc.canceled + r.canceled,
      onTime: acc.onTime + r.onTime,
      expense: acc.expense + r.expense,
    }),
    {
      plans: 0,
      savedKm: 0,
      savedMinutes: 0,
      optimizedKm: 0,
      baselineKm: 0,
      scoreSum: 0,
      delivered: 0,
      failed: 0,
      canceled: 0,
      onTime: 0,
      expense: 0,
    },
  );

  const finished = total.delivered + total.failed + total.canceled;

  return {
    from,
    to,
    savedKm: round(total.savedKm, 1),
    savedMinutes: round(total.savedMinutes, 1),
    optimizedKm: round(total.optimizedKm, 1),
    distanceSavingsRate: rate(total.savedKm, total.baselineKm),
    // Média ponderada pelo nº de planos do dia — a média das médias diárias
    // daria peso igual a um dia com 1 rota e outro com 50.
    averageScore: total.plans > 0 ? round(total.scoreSum / total.plans, 0) : null,
    delivered: total.delivered,
    finished,
    successRate: rate(total.delivered, finished),
    onTimeRate: rate(total.onTime, total.delivered),
    costPerDelivery: rate(total.expense, total.delivered),
    series: rows.map((r) => ({
      day: r.day,
      savedKm: round(r.savedKm, 1),
      delivered: r.delivered,
      successRate: rate(r.delivered, r.delivered + r.failed + r.canceled),
      onTimeRate: rate(r.onTime, r.delivered),
    })),
  };
}
