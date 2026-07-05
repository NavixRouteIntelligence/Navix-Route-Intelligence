import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Mapeamento ORM da tabela `refresh_tokens` (armazena apenas o hash). */
@Entity({ name: 'refresh_tokens' })
export class RefreshTokenOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Index('uq_refresh_tokens_hash', { unique: true })
  @Column('text', { name: 'token_hash' })
  tokenHash!: string;

  @Column('uuid', { name: 'family_id' })
  familyId!: string;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt!: Date;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column('timestamptz', { name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
