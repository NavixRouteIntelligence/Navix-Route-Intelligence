import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Mapeamento da tabela `delivery_tracking_tokens` (ADR-0082).
 *
 * **Sem RLS por decisão explícita** (ver a migração): é o ponto de entrada que
 * resolve o tenant de um request público, e por isso guarda apenas o token
 * opaco e os identificadores — nenhum dado pessoal. A leitura da entrega em si
 * acontece depois, já sob a transação de tenant e a RLS normal.
 */
@Entity({ name: 'delivery_tracking_tokens' })
export class DeliveryTrackingTokenOrmEntity {
  @PrimaryColumn('varchar', { length: 64 })
  token!: string;

  @Column('uuid', { name: 'delivery_id' })
  deliveryId!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;
}
