import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Mapeamento ORM da tabela `driver_invites` (ADR-0085). O próprio token é a
 * chave primária: toda leitura parte dele, nunca do e-mail.
 */
@Entity({ name: 'driver_invites' })
export class DriverInviteOrmEntity {
  @PrimaryColumn('varchar', { length: 64 })
  token!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('text')
  email!: string;

  @Column('uuid', { name: 'driver_id', nullable: true })
  driverId!: string | null;

  @Column('uuid', { name: 'invited_by' })
  invitedBy!: string;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt!: Date;

  @Column('timestamptz', { name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column('timestamptz', { name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
