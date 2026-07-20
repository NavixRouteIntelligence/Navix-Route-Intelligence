import type { FinancialEntryType } from '@navix/contracts';

/** Entrada mínima para o resumo (independe da entidade/banco). */
export interface SummaryEntry {
  type: FinancialEntryType;
  amountCents: number;
  category: string;
  odometerKm: number | null;
}

export interface SummaryResult {
  totalIncomeCents: number;
  totalExpenseCents: number;
  balanceCents: number;
  /** Km rodados = intervalo de hodômetro dos abastecimentos (>= 2 leituras). */
  distanceKm: number | null;
  /** Custo por km (€/km) = despesa ÷ km. `null` sem base de km. */
  costPerKm: number | null;
  /** Lucro por entrega (€) = saldo ÷ entregas. `null` sem entregas. */
  profitPerDelivery: number | null;
}

/**
 * Resume o ledger de um período (FASE 3, F1). Puro e determinístico.
 * - Km rodados: derivados do intervalo (max−min) de hodômetro dos lançamentos de
 *   combustível — a leitura mais confiável que temos sem histórico de odômetro.
 * - custo/km e lucro/entrega ficam `null` quando não há base (km 0 / entregas 0).
 */
export function summarize(entries: SummaryEntry[], deliveries: number): SummaryResult {
  let income = 0;
  let expense = 0;
  const fuelOdometers: number[] = [];

  for (const e of entries) {
    if (e.type === 'income') income += e.amountCents;
    else expense += e.amountCents;
    if (e.category === 'fuel' && e.odometerKm !== null) fuelOdometers.push(e.odometerKm);
  }

  const balance = income - expense;

  let distanceKm: number | null = null;
  if (fuelOdometers.length >= 2) {
    const span = Math.max(...fuelOdometers) - Math.min(...fuelOdometers);
    distanceKm = span > 0 ? span : null;
  }

  const costPerKm =
    distanceKm && distanceKm > 0 ? Math.round((expense / 100 / distanceKm) * 100) / 100 : null;
  const profitPerDelivery =
    deliveries > 0 ? Math.round((balance / 100 / deliveries) * 100) / 100 : null;

  return {
    totalIncomeCents: income,
    totalExpenseCents: expense,
    balanceCents: balance,
    distanceKm,
    costPerKm,
    profitPerDelivery,
  };
}
