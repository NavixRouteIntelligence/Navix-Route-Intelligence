import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Login sem `tenantId` (UUID) — o tenant é resolvido pelo **e-mail** (identidade
 * global) ou por um **identificador de empresa** (`slug`). Ver ADR-0016.
 *
 *  1. `tenants.slug` — identificador humano e único da organização, usado como
 *     alternativa ao e-mail no login (backfill determinístico para as linhas
 *     existentes: slug do nome + sufixo do id, garantindo unicidade).
 *  2. Índice único **global** de e-mail em `users` (case-insensitive): um e-mail
 *     passa a mapear para exatamente um usuário/tenant, tornando o login por
 *     e-mail determinístico. O `UNIQUE (tenant_id, email)` anterior é mantido.
 *
 * Nada aqui altera a RLS: login/refresh são fluxos públicos e `users`/`tenants`
 * não têm RLS (a resolução do tenant ocorre antes de haver contexto de tenant).
 */
export class TenantSlugAndEmailIdentity1720001400000 implements MigrationInterface {
  name = 'TenantSlugAndEmailIdentity1720001400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants ADD COLUMN slug text;`);
    // Backfill: slug a partir do nome + sufixo curto do id (unicidade garantida).
    await queryRunner.query(`
      UPDATE tenants SET slug =
        NULLIF(regexp_replace(regexp_replace(lower(coalesce(name, 'org')), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'), '')
        || '-' || substr(replace(id::text, '-', ''), 1, 6);
    `);
    await queryRunner.query(`UPDATE tenants SET slug = 'org-' || substr(replace(id::text, '-', ''), 1, 6) WHERE slug IS NULL;`);
    await queryRunner.query(`ALTER TABLE tenants ALTER COLUMN slug SET NOT NULL;`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_tenants_slug ON tenants (lower(slug));`);

    // E-mail globalmente único (case-insensitive).
    await queryRunner.query(`CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_users_email_lower;`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_tenants_slug;`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS slug;`);
  }
}
