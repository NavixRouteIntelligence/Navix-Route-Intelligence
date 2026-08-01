/**
 * KPIs da operação, servidos pelo **read model** diário (ADR-0092).
 *
 * As taxas são `null`, e não zero, quando falta denominador: "0% de sucesso" e
 * "ainda não houve entrega" são estados diferentes, e só o segundo é verdade
 * num tenant que começou hoje.
 */

/** Ponto diário da série — para o gráfico de evolução. */
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
  /** Quilômetros poupados pela otimização no período inteiro. */
  savedKm: number;
  /** Minutos poupados pela otimização no período inteiro. */
  savedMinutes: number;
  optimizedKm: number;
  /** Km poupados ÷ distância da ordem original. */
  distanceSavingsRate: number | null;
  /** Score médio das rotas, ponderado pelo nº de planos. */
  averageScore: number | null;
  delivered: number;
  /** Entregas que chegaram a um estado final (entregue, falhou ou cancelada). */
  finished: number;
  /** Entregues ÷ finalizadas. */
  successRate: number | null;
  /** Entregues no prazo ÷ entregues. */
  onTimeRate: number | null;
  /** Despesa ÷ entregues. */
  costPerDelivery: number | null;
  series: KpiPoint[];
}
