import type { PodStatus } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'proof_of_delivery' })
@Index('idx_pod_tenant_created', ['tenantId', 'recordedAt'])
@Index('uq_pod_delivery', ['tenantId', 'deliveryId'], { unique: true })
export class PodOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'delivery_id' })
  deliveryId!: string;

  @Column('uuid', { name: 'driver_id' })
  driverId!: string;

  @Column('text')
  status!: PodStatus;

  @Column('text', { nullable: true })
  note!: string | null;

  @Column('double precision', { nullable: true })
  latitude!: number | null;

  @Column('double precision', { nullable: true })
  longitude!: number | null;

  @Column('text', { nullable: true })
  photo!: string | null;

  @Column('text', { nullable: true })
  signature!: string | null;

  @Column('timestamptz', { name: 'recorded_at' })
  recordedAt!: Date;
}
