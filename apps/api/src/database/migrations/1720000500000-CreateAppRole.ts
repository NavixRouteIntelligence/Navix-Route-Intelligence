import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hardening (correção) — cria um role de RUNTIME não-superusuário para a
 * aplicação. Superusuários (como o owner `navix`) IGNORAM a RLS mesmo com FORCE;
 * por isso a app precisa conectar como um role comum, sujeito às políticas.
 *
 * Migrações/seed continuam usando o owner (DB_USER); a aplicação usa este role
 * (DB_APP_USER). Ver ADR-0012.
 *
 * As tabelas de auth (users) têm a RLS DESLIGADA: login/refresh consultam
 * usuários antes de existir contexto de tenant. O isolamento delas permanece no
 * nível de aplicação (filtro por tenant_id).
 */
export class CreateAppRole1720000500000 implements MigrationInterface {
  name = 'CreateAppRole1720000500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const user = process.env.DB_APP_USER ?? 'navix_app';
    const password = process.env.DB_APP_PASSWORD ?? 'navix_app_password';

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user}') THEN
          CREATE ROLE ${user} LOGIN PASSWORD '${password}'
            NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO ${user};`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${user};`,
    );
    await queryRunner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${user};`);
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${user};`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${user};`,
    );

    // Tabelas de auth: sem RLS (acesso pré-tenant nos fluxos públicos).
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON users;`);
    await queryRunner.query(`ALTER TABLE users DISABLE ROW LEVEL SECURITY;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const user = process.env.DB_APP_USER ?? 'navix_app';

    await queryRunner.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON users
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
    `);
    await queryRunner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${user};`);
    await queryRunner.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${user};`);
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM ${user};`);
    await queryRunner.query(`DROP ROLE IF EXISTS ${user};`);
  }
}
