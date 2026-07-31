import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Parâmetros do modelo de correção do ETA (ADR-0090). */
@Entity({ name: 'eta_corrections' })
export class EtaCorrectionOrmEntity {
  @PrimaryColumn('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @PrimaryColumn('text')
  bucket!: string;

  @Column('integer')
  samples!: number;

  @Column('double precision', { name: 'correction_minutes' })
  correctionMinutes!: number;

  @Column('timestamptz', { name: 'trained_at' })
  trainedAt!: Date;
}
