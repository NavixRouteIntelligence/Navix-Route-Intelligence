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
