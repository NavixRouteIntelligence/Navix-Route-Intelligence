import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Mapeamento da tabela `audit_log` (criada na migração InitPhase0). Append-only. */
@Entity({ name: 'audit_log' })
export class AuditLogOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id', nullable: true })
  tenantId!: string | null;

  @Column('uuid', { name: 'actor_id', nullable: true })
  actorId!: string | null;

  @Column('text')
  action!: string;

  @Column('text', { nullable: true })
  resource!: string | null;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, unknown>;

  @Column('timestamptz', { name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
