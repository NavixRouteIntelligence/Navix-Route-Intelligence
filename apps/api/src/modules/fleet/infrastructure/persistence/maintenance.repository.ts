import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type { MaintenanceRepositoryPort } from '../../domain/ports/maintenance-repository.port';
import { MaintenanceRecord } from '../../domain/maintenance-record';
import { MaintenanceOrmEntity } from './maintenance.orm-entity';

/** Converte um `Date` para a coluna `date` do Postgres (YYYY-MM-DD, UTC). */
function toDateColumn(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Converte a coluna `date` (YYYY-MM-DD) para `Date` em UTC (meia-noite). */
function fromDateColumn(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/**
 * Repositório TypeORM de manutenção. Usa o repositório ligado à transação do
 * request (com `app.current_tenant` → RLS) e filtra por `tenant_id`
 * explicitamente (defesa em profundidade — docs/security.md §3).
 */
@Injectable()
export class MaintenanceRepository implements MaintenanceRepositoryPort {
  constructor(
    @InjectRepository(MaintenanceOrmEntity)
    private readonly base: Repository<MaintenanceOrmEntity>,
  ) {}

  private get repo(): Repository<MaintenanceOrmEntity> {
    return scopedRepository(this.base);
  }

  async save(record: MaintenanceRecord): Promise<void> {
    const s = record.snapshot();
    await this.repo.save(
      this.repo.create({
        id: s.id,
        tenantId: s.tenantId,
        vehicleId: s.vehicleId,
        type: s.type,
        performedAt: toDateColumn(s.performedAt),
        odometerKm: s.odometerKm,
        costCents: s.costCents,
        notes: s.notes,
        nextDueDate: s.nextDueDate ? toDateColumn(s.nextDueDate) : null,
        nextDueOdometerKm: s.nextDueOdometerKm,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }),
    );
  }

  async findById(tenantId: string, id: string): Promise<MaintenanceRecord | null> {
    const row = await this.repo.findOne({ where: { tenantId, id } });
    return row ? this.toDomain(row) : null;
  }

  async findByVehicle(tenantId: string, vehicleId: string): Promise<MaintenanceRecord[]> {
    const rows = await this.repo.find({
      where: { tenantId, vehicleId },
      order: { performedAt: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.repo.delete({ tenantId, id });
  }

  private toDomain(row: MaintenanceOrmEntity): MaintenanceRecord {
    return MaintenanceRecord.restore({
      id: row.id,
      tenantId: row.tenantId,
      vehicleId: row.vehicleId,
      type: row.type,
      performedAt: fromDateColumn(row.performedAt),
      odometerKm: row.odometerKm,
      costCents: row.costCents,
      notes: row.notes,
      nextDueDate: row.nextDueDate ? fromDateColumn(row.nextDueDate) : null,
      nextDueOdometerKm: row.nextDueOdometerKm,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
