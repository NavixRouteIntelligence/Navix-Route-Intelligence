import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import { FinancialEntry } from '../../domain/financial-entry';
import type { FinancialEntryRepositoryPort } from '../../domain/ports/financial-entry-repository.port';
import { FinancialEntryOrmEntity } from './financial-entry.orm-entity';

function toDateColumn(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fromDateColumn(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/**
 * Repositório TypeORM do ledger financeiro. Usa o repositório ligado à transação
 * do request (RLS por `app.current_tenant`) e filtra por `tenant_id` também no
 * WHERE (defesa em profundidade — docs/security.md §3).
 */
@Injectable()
export class FinancialEntryRepository implements FinancialEntryRepositoryPort {
  constructor(
    @InjectRepository(FinancialEntryOrmEntity)
    private readonly base: Repository<FinancialEntryOrmEntity>,
  ) {}

  private get repo(): Repository<FinancialEntryOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(entry: FinancialEntry): Promise<void> {
    const s = entry.snapshot();
    await this.repo.save(
      this.repo.create({
        id: s.id,
        tenantId: s.tenantId,
        type: s.type,
        category: s.category,
        amountCents: s.amountCents,
        occurredAt: toDateColumn(s.occurredAt),
        odometerKm: s.odometerKm,
        liters: s.liters === null ? null : s.liters.toFixed(2),
        notes: s.notes,
        createdAt: s.createdAt,
      }),
    );
  }

  async findById(tenantId: string, id: string): Promise<FinancialEntry | null> {
    const row = await this.repo.findOne({ where: { tenantId, id } });
    return row ? this.toDomain(row) : null;
  }

  async findInRange(tenantId: string, from: Date, to: Date): Promise<FinancialEntry[]> {
    const rows = await this.repo.find({
      where: { tenantId, occurredAt: Between(toDateColumn(from), toDateColumn(to)) },
      order: { occurredAt: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.repo.delete({ tenantId, id });
  }

  private toDomain(row: FinancialEntryOrmEntity): FinancialEntry {
    return FinancialEntry.restore({
      id: row.id,
      tenantId: row.tenantId,
      type: row.type,
      category: row.category,
      amountCents: row.amountCents,
      occurredAt: fromDateColumn(row.occurredAt),
      odometerKm: row.odometerKm,
      liters: row.liters === null ? null : Number(row.liters),
      notes: row.notes,
      createdAt: row.createdAt,
    });
  }
}
