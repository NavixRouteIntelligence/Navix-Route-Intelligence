import type { FinancialEntryType, HistoryGranularity } from '@navix/contracts';

export interface HistoryEntry {
  type: FinancialEntryType;
  amountCents: number;
  occurredAt: Date;
}

export interface HistoryBucket {
  period: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

/** Chave do período (UTC): 'YYYY-MM' (mês) ou 'YYYY-MM-DD' (segunda-feira, semana). */
export function periodKey(date: Date, granularity: HistoryGranularity): string {
  if (granularity === 'month') return date.toISOString().slice(0, 7);
  // Semana: segunda-feira como início (ISO). getUTCDay(): 0=domingo … 6=sábado.
  const day = date.getUTCDay();
  const offset = (day + 6) % 7; // dias desde a segunda
  const monday = new Date(date.getTime() - offset * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
}

/**
 * Agrupa os lançamentos por período (FASE 3, F3), somando receita/despesa e o
 * saldo. Puro e determinístico; retorna os pontos do mais antigo ao mais recente.
 */
export function bucketHistory(entries: HistoryEntry[], granularity: HistoryGranularity): HistoryBucket[] {
  const byPeriod = new Map<string, { income: number; expense: number }>();
  for (const e of entries) {
    const key = periodKey(e.occurredAt, granularity);
    const acc = byPeriod.get(key) ?? { income: 0, expense: 0 };
    if (e.type === 'income') acc.income += e.amountCents;
    else acc.expense += e.amountCents;
    byPeriod.set(key, acc);
  }

  return [...byPeriod.entries()]
    .map(([period, { income, expense }]) => ({
      period,
      incomeCents: income,
      expenseCents: expense,
      balanceCents: income - expense,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}
