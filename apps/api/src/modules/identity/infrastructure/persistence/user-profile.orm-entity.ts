import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Perfil do usuário (1:1 com `users`). Escopado por tenant (RLS FORCE + policy).
 * O avatar é guardado como data URL (coerente com o padrão de mídia do projeto).
 * PK = `user_id`.
 */
@Entity({ name: 'user_profiles' })
@Index('idx_user_profiles_tenant', ['tenantId'])
export class UserProfileOrmEntity {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('text', { name: 'display_name' })
  displayName!: string;

  @Column('text', { nullable: true })
  phone!: string | null;

  @Column('text', { name: 'job_title', nullable: true })
  jobTitle!: string | null;

  @Column('text', { name: 'time_zone' })
  timeZone!: string;

  @Column('text', { nullable: true })
  avatar!: string | null;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}
