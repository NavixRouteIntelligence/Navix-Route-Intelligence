import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'password_reset_tokens' })
export class PasswordResetTokenOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_password_reset_user')
  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Index('uq_password_reset_hash', { unique: true })
  @Column('text', { name: 'token_hash' })
  tokenHash!: string;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt!: Date;

  @Column('timestamptz', { name: 'used_at', nullable: true })
  usedAt!: Date | null;

  @Column('timestamptz', { name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
