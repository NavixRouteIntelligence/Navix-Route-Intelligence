import type { FinancialEntry as FinancialEntryView } from '@navix/contracts';

import type { FinancialEntry } from '../domain/financial-entry';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Converte a entidade de domínio na view pública (cents → euros). */
export function toFinancialEntryView(entry: FinancialEntry): FinancialEntryView {
  const s = entry.snapshot();
  return {
    id: s.id,
    tenantId: s.tenantId,
    type: s.type,
    category: s.category,
    amount: Math.round(s.amountCents) / 100,
    occurredAt: isoDate(s.occurredAt),
    odometerKm: s.odometerKm,
    liters: s.liters,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}
