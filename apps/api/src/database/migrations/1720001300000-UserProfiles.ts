import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Perfil do usuário — tabela `user_profiles` (1:1 com `users`). Guarda dados de
 * identificação exibíveis (nome, telefone, cargo, fuso) e o avatar como data URL.
 * Escopada por tenant (RLS FORCE + policy) com grant ao role de runtime.
 * Ver docs/modules/settings.md §3.1.
 */
export class UserProfiles1720001300000 implements MigrationInterface {
  name = 'UserProfiles1720001300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_profiles (
        user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        display_name text NOT NULL,
        phone        text,
        job_title    text,
        time_zone    text NOT NULL,
        avatar       text,
        updated_at   timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_user_profiles_tenant ON user_profiles (tenant_id);`,
    );

    await queryRunner.query(`ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON user_profiles
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON user_profiles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_profiles;`);
  }
}
