import { Inject, Injectable } from '@nestjs/common';
import type { FinancialSummary } from '@navix/contracts';

import { summarize } from '../domain/summarize';
import {
  FINANCIAL_ENTRY_REPOSITORY,
  type FinancialEntryRepositoryPort,
} from '../domain/ports/financial-entry-repository.port';
import { DELIVERY_COUNT, type DeliveryCountPort } from './ports/delivery-count.port';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resumo financeiro do período (FASE 3, F1): cruza o ledger com o nº de entregas
 * concluídas para derivar custo/km e lucro/entrega. Cents → euros na resposta.
 */
@Injectable()
export class GetFinancialSummaryUseCase {
  constructor(
    @Inject(FINANCIAL_ENTRY_REPOSITORY) private readonly entries: FinancialEntryRepositoryPort,
    @Inject(DELIVERY_COUNT) private readonly deliveries: DeliveryCountPort,
  ) {}

  async execute(tenantId: string, from: Date, to: Date): Promise<FinancialSummary> {
    const entries = await this.entries.findInRange(tenantId, from, to);
    const deliveries = await this.deliveries.countDeliveredInRange(tenantId, from, to);

    const s = summarize(
      entries.map((e) => {
        const snap = e.snapshot();
        return {
          type: snap.type,
          amountCents: snap.amountCents,
          category: snap.category,
          odometerKm: snap.odometerKm,
        };
      }),
      deliveries,
    );

    return {
      from: isoDate(from),
      to: isoDate(to),
      totalIncome: Math.round(s.totalIncomeCents) / 100,
      totalExpense: Math.round(s.totalExpenseCents) / 100,
      balance: Math.round(s.balanceCents) / 100,
      distanceKm: s.distanceKm,
      costPerKm: s.costPerKm,
      deliveries,
      profitPerDelivery: s.profitPerDelivery,
    };
  }
}
