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

/**
 * Desempenho do próprio motorista (ADR-0097).
 *
 * A forma deste contrato é a restrição ética: **não existe** campo de ranking,
 * de média da frota, de entregas por hora ou de velocidade. Quem for adicionar
 * um deles vai ter que passar por `apps/api/src/modules/analytics/domain/
 * driver-performance.ts`, onde a razão de cada ausência está escrita.
 */
export interface DriverPerformanceView {
  from: string;
  to: string;
  delivered: number;
  /** Dias em que houve alguma entrega. Dias de folga não contam nem punem. */
  workedDays: number;
  /** Entregues ÷ finalizadas. `null` sem finalizadas. */
  successRate: number | null;
  /** Informativo. Nunca vira meta nem alimenta a sequência. */
  onTimeRate: number | null;
  streak: HealthyStreakView;
  goal: DriverGoalView | null;
  restAdvice: RestAdviceView | null;
}

/** Sequência de dias trabalhados **sem falha**. Descansar não quebra. */
export interface HealthyStreakView {
  days: number;
  current: boolean;
}

/** Meta do motorista contra ele mesmo — sempre uma taxa, nunca um volume. */
export interface DriverGoalView {
  target: number;
  current: number;
  met: boolean;
}

/** Única leitura de jornada, e ela aponta para parar. */
export interface RestAdviceView {
  activeMinutes: number;
  longDay: boolean;
}
