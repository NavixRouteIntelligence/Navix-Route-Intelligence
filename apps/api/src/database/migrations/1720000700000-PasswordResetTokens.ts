import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Frontend/Fase 1 — tabela `password_reset_tokens` para o fluxo de recuperação
 * de senha. Guarda apenas o HASH do token, com expiração e uso único. Sem RLS
 * (fluxo pré-tenant, como as demais tabelas de auth).
 */
export class PasswordResetTokens1720000700000 implements MigrationInterface {
  name = 'PasswordResetTokens1720000700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id          uuid PRIMARY KEY,
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  text NOT NULL,
        expires_at  timestamptz NOT NULL,
        used_at     timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_password_reset_hash UNIQUE (token_hash)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_password_reset_user ON password_reset_tokens (user_id);`,
    );
    // Concede acesso ao role de runtime (criado por CreateAppRole).
    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS password_reset_tokens;`);
  }
}
