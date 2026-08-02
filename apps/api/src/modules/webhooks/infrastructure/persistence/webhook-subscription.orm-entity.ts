import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'webhook_subscriptions' })
export class WebhookSubscriptionOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'tenant_id' }) tenantId!: string;
  @Column('varchar', { length: 120 }) name!: string;
  @Column('text') url!: string;
  @Column('text', { array: true }) events!: string[];
  @Column('text', { name: 'encrypted_secret' }) encryptedSecret!: string;
  @Column('boolean') enabled!: boolean;
  @Column('timestamptz', { name: 'created_at' }) createdAt!: Date;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt!: Date;
}
