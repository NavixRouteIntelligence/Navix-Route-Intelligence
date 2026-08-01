import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../shared/tenancy/tenant-context';
import {
  FINANCIAL_ENTRY_REPOSITORY,
  type FinancialEntryRepositoryPort,
} from '../domain/ports/financial-entry-repository.port';

@Injectable()
export class DeleteFinancialEntryUseCase {
  constructor(
    @Inject(FINANCIAL_ENTRY_REPOSITORY) private readonly entries: FinancialEntryRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly events: DomainEventBus,
  ) {}

  async execute(tenantId: string, id: string): Promise<void> {
    const existing = await this.entries.findById(tenantId, id);
    if (!existing) throw new NotFoundError('Lançamento não encontrado.');
    await this.entries.delete(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'finance.entry.deleted',
      resource: `financial-entry:${id}`,
    });
    this.events.publish(tenantId, {
      type: 'finance.entry-deleted',
      aggregateId: id,
      affectedDay: existing.snapshot().occurredAt.toISOString().slice(0, 10),
    });
  }
}
