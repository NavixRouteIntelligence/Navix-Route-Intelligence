import type { FinancialCategory, FinancialEntryType } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'financial_entries' })
@Index('idx_financial_entries_tenant_date', ['tenantId', 'occurredAt'])
export class FinancialEntryOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('text')
  type!: FinancialEntryType;

  @Column('text')
  category!: FinancialCategory;

  @Column('integer', { name: 'amount_cents' })
  amountCents!: number;

  @Column('date', { name: 'occurred_at' })
  occurredAt!: string; // 'YYYY-MM-DD'

  @Column('integer', { name: 'odometer_km', nullable: true })
  odometerKm!: number | null;

  // numeric → string no TypeORM; convertido no repositório.
  @Column('numeric', { precision: 7, scale: 2, nullable: true })
  liters!: string | null;

  @Column('text', { nullable: true })
  notes!: string | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;
}
