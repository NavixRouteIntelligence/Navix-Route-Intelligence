import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Mapeamento ORM da tabela `users`. A entidade de domínio (domain/user.ts)
 * é mantida separada do detalhe de persistência (ver docs/architecture.md §3).
 */
@Entity({ name: 'users' })
@Index('uq_users_tenant_email', ['tenantId', 'email'], { unique: true })
export class UserOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('text')
  email!: string;

  @Column('text', { name: 'password_hash' })
  passwordHash!: string;

  @Column('text', { default: 'active' })
  status!: 'active' | 'suspended';

  @Column('text', { array: true, default: '{}' })
  roles!: string[];

  @Column('timestamptz', { name: 'created_at', default: () => 'now()' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'updated_at', default: () => 'now()' })
  updatedAt!: Date;
}
