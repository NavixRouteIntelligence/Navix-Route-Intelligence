import type { DeliveryPriority, DeliveryStatus } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Mapeamento ORM da tabela `deliveries`. Endereço achatado em colunas + coluna
 * geográfica `location` (PostGIS) gerada na migração para uso futuro do
 * otimizador. A entidade de domínio (domain/delivery.ts) permanece separada.
 */
@Entity({ name: 'deliveries' })
@Index('idx_deliveries_tenant_status', ['tenantId', 'status'])
@Index('idx_deliveries_tenant_created', ['tenantId', 'createdAt'])
export class DeliveryOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  // Endereço
  @Column('text')
  street!: string;

  @Column('text')
  number!: string;

  @Column('text', { nullable: true })
  complement!: string | null;

  @Column('text')
  city!: string;

  @Column('text')
  state!: string;

  @Column('text', { name: 'postal_code' })
  postalCode!: string;

  @Column('text')
  country!: string;

  @Column('double precision')
  latitude!: number;

  @Column('double precision')
  longitude!: number;

  // Atributos da entrega
  @Column('text', { default: 'normal' })
  priority!: DeliveryPriority;

  @Column('timestamptz', { name: 'window_start' })
  windowStart!: Date;

  @Column('timestamptz', { name: 'window_end' })
  windowEnd!: Date;

  @Column('text', { default: 'pending' })
  status!: DeliveryStatus;

  @Column('uuid', { name: 'driver_id', nullable: true })
  driverId!: string | null;

  @Column('uuid', { name: 'vehicle_id', nullable: true })
  vehicleId!: string | null;

  @Column('uuid', { name: 'route_id', nullable: true })
  routeId!: string | null;

  @Column('text', { nullable: true })
  notes!: string | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;

  @Column('timestamptz', { name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
