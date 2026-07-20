import { Inject, Injectable } from '@nestjs/common';
import type { CreateFinancialEntryRequest, FinancialEntry as FinancialEntryView } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ValidationError } from '../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../shared/tenancy/tenant-context';
import { FinancialEntry } from '../domain/financial-entry';
import {
  FINANCIAL_ENTRY_REPOSITORY,
  type FinancialEntryRepositoryPort,
} from '../domain/ports/financial-entry-repository.port';
import { toFinancialEntryView } from './financial-entry.mapper';

export type CreateFinancialEntryCommand = CreateFinancialEntryRequest & { tenantId: string };

function parseDate(value: string): Date {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new ValidationError('Data inválida.');
  return d;
}

@Injectable()
export class CreateFinancialEntryUseCase {
  constructor(
    @Inject(FINANCIAL_ENTRY_REPOSITORY) private readonly entries: FinancialEntryRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: CreateFinancialEntryCommand): Promise<FinancialEntryView> {
    const entry = FinancialEntry.create({
      tenantId: command.tenantId,
      type: command.type,
      category: command.category,
      amountCents: Math.round(command.amount * 100),
      occurredAt: parseDate(command.occurredAt),
      odometerKm: command.odometerKm ?? null,
      liters: command.liters ?? null,
      notes: command.notes ?? null,
    });

    await this.entries.save(entry);
    const view = toFinancialEntryView(entry);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'finance.entry.created',
      resource: `financial-entry:${view.id}`,
      metadata: { type: command.type, category: command.category },
    });
    return view;
  }
}
