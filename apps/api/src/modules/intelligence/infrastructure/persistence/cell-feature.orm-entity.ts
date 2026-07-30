import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Feature materializada de (célula, balde temporal) — ADR-0089. */
@Entity({ name: 'cell_features' })
@Index('idx_cell_features_lookup', ['tenantId', 'cell'])
export class CellFeatureOrmEntity {
  @PrimaryColumn('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @PrimaryColumn('text')
  cell!: string;

  @PrimaryColumn('text')
  bucket!: string;

  @Column('integer')
  samples!: number;

  @Column('double precision', { name: 'service_minutes_p50' })
  serviceMinutesP50!: number;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}
