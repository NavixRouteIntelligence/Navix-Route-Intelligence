import { Inject, Injectable } from '@nestjs/common';
import type { FinancialHistory, HistoryGranularity } from '@navix/contracts';

import { bucketHistory } from '../domain/history';
import {
  FINANCIAL_ENTRY_REPOSITORY,
  type FinancialEntryRepositoryPort,
} from '../domain/ports/financial-entry-repository.port';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
const cents = (v: number): number => Math.round(v) / 100;

/** Histórico financeiro por período (FASE 3, F3): série de receita/despesa/saldo. */
@Injectable()
export class GetFinancialHistoryUseCase {
  constructor(
    @Inject(FINANCIAL_ENTRY_REPOSITORY) private readonly entries: FinancialEntryRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    from: Date,
    to: Date,
    granularity: HistoryGranularity,
  ): Promise<FinancialHistory> {
    const rows = await this.entries.findInRange(tenantId, from, to);
    const buckets = bucketHistory(
      rows.map((r) => {
        const s = r.snapshot();
        return { type: s.type, amountCents: s.amountCents, occurredAt: s.occurredAt };
      }),
      granularity,
    );
    return {
      granularity,
      from: isoDate(from),
      to: isoDate(to),
      points: buckets.map((b) => ({
        period: b.period,
        income: cents(b.incomeCents),
        expense: cents(b.expenseCents),
        balance: cents(b.balanceCents),
      })),
    };
  }
}
