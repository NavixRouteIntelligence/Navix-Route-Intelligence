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

/**
 * Estado de um dia no read model (ADR-0117).
 *
 * `pending` e `no-work` são coisas diferentes e pareciam-se: sem estado, um dia
 * ainda não projetado e um dia de folga chegavam à tela como o mesmo zero.
 */
export type DriverDayState = 'ok' | 'incomplete' | 'no-work' | 'pending';

/** Poupança do dia — **estimativa contrafactual**, nunca resultado medido. */
export interface DriverDaySavings {
  /** Diferença face à ordem em que as paragens foram enviadas (ADR-0116). */
  distanceKm: number | null;
  timeMinutes: number | null;
  /** `null` quando o dia misturou veículos ou o tipo é desconhecido. */
  fuelLiters: number | null;
  /** Sempre `true`: nada aqui foi medido no veículo de ninguém. */
  estimated: true;
}

/** Fotografia de um dia do motorista. Taxas derivadas; contagens cruas. */
export interface DriverDailySnapshot {
  day: string;
  state: DriverDayState;
  delivered: number;
  failed: number;
  onTime: number;
  /** `null` sem finalizadas — nunca 0%. */
  successRate: number | null;
  /** `null` sem entregues. */
  onTimeRate: number | null;
  /** `null` quando a duração não é conhecida (ADR-0117). */
  activeMinutes: number | null;
  /** `null` quando não há plano atribuível no dia. */
  savings: DriverDaySavings | null;
  /** `null` em `pending`. */
  projectedAt: string | null;
  /**
   * Comparação com o próprio histórico (ADR-0118). Ausente quando o dia pedido
   * não é o último trabalhado — a comparação é sempre do dia mais recente com
   * trabalho, e prendê-la a um dia arbitrário seria outra pergunta.
   */
  baseline?: DriverPersonalBaseline;
  /** A melhoria escolhida para hoje (ADR-0119). Uma, ou nenhuma explicada. */
  recommendation?: KaizenRecommendationView;
}

/**
 * Classificação de um indicador face ao próprio histórico (ADR-0118).
 *
 * `building-history` não é "estável": estável afirma que nada mudou, e aqui
 * ainda não se sabe.
 */
export type DriverTrend = 'improved' | 'stable' | 'attention' | 'building-history';

export interface DriverIndicator {
  current: number | null;
  baseline: number | null;
  trend: DriverTrend;
  /** Dias trabalhados que entraram na mediana. */
  sample: number;
  /** `true` quando o indicador só informa: não gera ação nem meta. */
  informative?: true;
}

/** Comparação com o próprio histórico. Nunca com outra pessoa. */
export interface DriverPersonalBaseline {
  day: string | null;
  delivered: DriverIndicator;
  successRate: DriverIndicator;
  onTimeRate: DriverIndicator;
  activeMinutes: DriverIndicator;
}

/** Categoria da recomendação Kaizen, na ordem de prioridade (ADR-0119). */
export type KaizenCategoryView =
  | 'rest'
  | 'delivery-failures'
  | 'address-preparation'
  | 'load-organization'
  | 'fuel-maintenance'
  | 'sustainability';

/** Chave estável da mensagem. O texto vive no `pt_PT` da app, não aqui. */
export type KaizenCodeView =
  | 'rest.long-day'
  | 'rest.longer-than-usual'
  | 'failures.repeated'
  | 'failures.first'
  | 'load.follow-suggested-order'
  | 'none.acknowledge'
  | 'none.building-history'
  | 'none.no-work';

/** Métrica do payload que sustenta a recomendação. */
export interface KaizenEvidenceView {
  metric: string;
  value: number | null;
  baseline?: number | null;
}

/** Ação de **preparação** — nunca de ritmo. */
export type KaizenActionView =
  | { kind: 'plan-shorter-day' }
  | { kind: 'review-failed-deliveries'; count: number }
  | { kind: 'load-in-route-order' };

/**
 * Uma melhoria para hoje (ADR-0119). No máximo uma por dia, e sempre com a
 * evidência que a produziu: dada a recomendação, dá para apontar os números.
 */
export interface KaizenRecommendationView {
  code: KaizenCodeView;
  category: KaizenCategoryView | null;
  evidence: KaizenEvidenceView[];
  action: KaizenActionView | null;
}
