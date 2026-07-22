/**
 * Contratos do contexto Finance (FASE 3 — inteligência financeira do motorista).
 * Ledger simples: entradas de receita/despesa que alimentam custo/km e
 * lucro/entrega. Valores em euros (2 casas); datas ISO 'YYYY-MM-DD'.
 */

export type FinancialEntryType = 'income' | 'expense';

export type FinancialCategory = 'fuel' | 'maintenance' | 'toll' | 'delivery' | 'other';

export const FINANCIAL_CATEGORIES: readonly FinancialCategory[] = [
  'fuel',
  'maintenance',
  'toll',
  'delivery',
  'other',
];

export interface FinancialEntry {
  id: string;
  tenantId: string;
  type: FinancialEntryType;
  category: FinancialCategory;
  amount: number;
  occurredAt: string;
  /** Hodômetro no momento (km) — usado para derivar km rodados (abastecimentos). */
  odometerKm: number | null;
  /** Litros abastecidos — presente em despesas de combustível. */
  liters: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateFinancialEntryRequest {
  type: FinancialEntryType;
  category: FinancialCategory;
  amount: number;
  occurredAt: string;
  odometerKm?: number | null;
  liters?: number | null;
  notes?: string | null;
}

/**
 * Resumo financeiro de um período. `costPerKm` = despesa ÷ km rodados (derivados
 * do intervalo de hodômetro dos abastecimentos); `profitPerDelivery` = saldo ÷ nº
 * de entregas concluídas. `null` quando não há base suficiente (sem km / sem entregas).
 */
export interface FinancialSummary {
  from: string;
  to: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  distanceKm: number | null;
  costPerKm: number | null;
  deliveries: number;
  profitPerDelivery: number | null;
}

/** Granularidade do histórico financeiro (FASE 3, F3). */
export type HistoryGranularity = 'week' | 'month';

export const HISTORY_GRANULARITIES: readonly HistoryGranularity[] = ['week', 'month'];

/** Um ponto da série: receita/despesa/saldo do período. */
export interface FinancialHistoryPoint {
  /** Chave do período: 'YYYY-MM' (mês) ou 'YYYY-MM-DD' (segunda-feira da semana, UTC). */
  period: string;
  income: number;
  expense: number;
  balance: number;
}

/** Histórico financeiro por período (FASE 3, F3), do mais antigo ao mais recente. */
export interface FinancialHistory {
  granularity: HistoryGranularity;
  from: string;
  to: string;
  points: FinancialHistoryPoint[];
}
