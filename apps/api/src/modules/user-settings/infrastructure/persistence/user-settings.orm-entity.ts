import type { UserSettings } from '@navix/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Preferências do usuário (1:1 com `users`). Os valores ficam num único JSONB
 * `data`, validado pelo contrato na aplicação; a linha é escopada por tenant
 * (RLS FORCE + policy). PK = `user_id`.
 */
@Entity({ name: 'user_settings' })
@Index('idx_user_settings_tenant', ['tenantId'])
export class UserSettingsOrmEntity {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('jsonb')
  data!: UserSettings;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}
