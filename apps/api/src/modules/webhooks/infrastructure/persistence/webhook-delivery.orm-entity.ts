import { Column, Entity, PrimaryColumn } from 'typeorm';

export type WebhookDeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'dead';

@Entity({ name: 'webhook_deliveries' })
export class WebhookDeliveryOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'tenant_id' }) tenantId!: string;
  @Column('uuid', { name: 'subscription_id' }) subscriptionId!: string;
  @Column('varchar', { name: 'event_type', length: 80 }) eventType!: string;
  @Column('uuid', { name: 'aggregate_id' }) aggregateId!: string;
  @Column('jsonb') payload!: Record<string, unknown>;
  @Column('varchar', { length: 20 }) status!: WebhookDeliveryStatus;
  @Column('integer') attempts!: number;
  @Column('timestamptz', { name: 'next_attempt_at' }) nextAttemptAt!: Date;
  @Column('text', { name: 'last_error', nullable: true }) lastError!: string | null;
  @Column('integer', { name: 'response_status', nullable: true }) responseStatus!: number | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt!: Date;
  @Column('timestamptz', { name: 'delivered_at', nullable: true }) deliveredAt!: Date | null;
}
