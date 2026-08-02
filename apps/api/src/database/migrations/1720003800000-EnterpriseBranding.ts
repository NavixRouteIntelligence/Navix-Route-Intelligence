import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Base white-label Enterprise. A leitura é pública porque a marca precisa ser
 * resolvida antes do login; a escrita continua escopada pelo tenant via RLS.
 * Nenhum segredo de SSO é armazenado nesta tabela.
 */
export class EnterpriseBranding1720003800000 implements MigrationInterface {
  name = 'EnterpriseBranding1720003800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_branding (
        tenant_id                    uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        display_name                 text,
        logo_url                     text,
        primary_color                varchar(7),
        accent_color                 varchar(7),
        custom_domain                text,
        custom_domain_verified_at    timestamptz,
        updated_at                   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_tenant_branding_primary_color
          CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
        CONSTRAINT ck_tenant_branding_accent_color
          CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$')
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_tenant_branding_custom_domain
        ON tenant_branding (lower(custom_domain))
        WHERE custom_domain IS NOT NULL;
    `);
    await queryRunner.query(`ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE tenant_branding FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_branding_public_read ON tenant_branding
        FOR SELECT USING (true);
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_branding_tenant_insert ON tenant_branding
        FOR INSERT WITH CHECK (
          tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
        );
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_branding_tenant_update ON tenant_branding
        FOR UPDATE
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_branding_tenant_delete ON tenant_branding
        FOR DELETE USING (
          tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
        );
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'navix_app') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_branding TO navix_app;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_branding;`);
  }
}
