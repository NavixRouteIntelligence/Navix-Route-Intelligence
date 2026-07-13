import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preferências do usuário — tabela `user_settings` (1:1 com `users`). Guarda
 * Tema, Idioma e Preferências de UI num JSONB `data`. Escopada por tenant
 * (RLS FORCE + policy) com grant ao role de runtime.
 * Ver docs/modules/settings.md §6.
 */
export class UserSettings1720001200000 implements MigrationInterface {
  name = 'UserSettings1720001200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_settings (
        user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        data        jsonb NOT NULL,
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_user_settings_tenant ON user_settings (tenant_id);`,
    );

    await queryRunner.query(`ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON user_settings
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON user_settings TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON user_settings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_settings;`);
  }
}
