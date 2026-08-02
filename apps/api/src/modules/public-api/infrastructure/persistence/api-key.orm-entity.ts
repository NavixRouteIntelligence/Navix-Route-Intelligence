import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'api_keys' })
export class ApiKeyOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'tenant_id' }) tenantId!: string;
  @Column('varchar', { length: 120 }) name!: string;
  @Column('varchar', { name: 'key_prefix', length: 24 }) keyPrefix!: string;
  @Column('text', { name: 'key_hash' }) secretHash!: string;
  @Column('text', { array: true }) scopes!: string[];
  @Column('integer', { name: 'quota_per_minute' }) quotaPerMinute!: number;
  @Column('timestamptz', { name: 'expires_at', nullable: true }) expiresAt!: Date | null;
  @Column('timestamptz', { name: 'last_used_at', nullable: true }) lastUsedAt!: Date | null;
  @Column('timestamptz', { name: 'revoked_at', nullable: true }) revokedAt!: Date | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt!: Date;
}
