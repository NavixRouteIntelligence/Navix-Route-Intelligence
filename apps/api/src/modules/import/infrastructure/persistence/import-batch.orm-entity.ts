import type { ImportBatchStatus, ImportFileType, ImportSummary } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import type { StoredImportRow } from '../../domain/import-row';

@Entity({ name: 'import_batches' })
@Index('idx_import_batches_tenant_created', ['tenantId', 'createdAt'])
export class ImportBatchOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'created_by' })
  createdBy!: string;

  @Column('text')
  filename!: string;

  @Column('text', { name: 'file_type' })
  fileType!: ImportFileType;

  @Column('text', { default: 'preview' })
  status!: ImportBatchStatus;

  @Column('jsonb')
  summary!: ImportSummary;

  @Column('jsonb')
  rows!: StoredImportRow[];

  @Column('integer', { name: 'created_deliveries', default: 0 })
  createdDeliveries!: number;

  @Column('uuid', { name: 'route_plan_id', nullable: true })
  routePlanId!: string | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'imported_at', nullable: true })
  importedAt!: Date | null;
}
