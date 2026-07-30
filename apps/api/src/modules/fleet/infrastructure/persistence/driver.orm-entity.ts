import type { DriverStatus } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'drivers' })
@Index('uq_drivers_tenant_license', ['tenantId', 'licenseNumber'], { unique: true })
export class DriverOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_drivers_tenant')
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('text')
  name!: string;

  @Column('text', { name: 'license_number' })
  licenseNumber!: string;

  @Column('text', { array: true, default: '{}' })
  skills!: string[];

  @Column('text', { default: 'active' })
  status!: DriverStatus;

  /** Login do motorista (ADR-0085). Nulo para ficha sem conta no app. */
  @Column('uuid', { name: 'user_id', nullable: true })
  userId!: string | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}
