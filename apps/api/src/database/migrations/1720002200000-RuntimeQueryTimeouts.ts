import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hardening de produção (Fase 1) — limita queries e transações ociosas do role
 * de RUNTIME (`navix_app`).
 *
 * **Por que como default do ROLE (`ALTER ROLE ... SET`):** a aplicação conecta
 * via PgBouncer em **modo transaction**, onde um `SET` de sessão não persiste
 * entre transações. O default do role é aplicado a **toda** conexão daquele
 * role no startup — confiável através do pooler. Migrações e seed usam o OWNER
 * (`navix`), que não recebe estes limites e pode rodar operações longas.
 *
 * - `statement_timeout`: aborta query que passa do teto → uma query travada não
 *   segura uma conexão do pool indefinidamente (esgotamento de conexões).
 * - `idle_in_transaction_session_timeout`: aborta transação deixada aberta (bug)
 *   → evita locks presos e conexões vazadas.
 *
 * Valores são padrões conservadores (queries normais são <1s); calibre por
 * deploy se necessário. 0 = desabilitado no Postgres — aqui usamos limites reais.
 */
const STATEMENT_TIMEOUT = '15s';
const IDLE_IN_TX_TIMEOUT = '30s';

export class RuntimeQueryTimeouts1720002200000 implements MigrationInterface {
  name = 'RuntimeQueryTimeouts1720002200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const role = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(`ALTER ROLE "${role}" SET statement_timeout = '${STATEMENT_TIMEOUT}'`);
    await queryRunner.query(
      `ALTER ROLE "${role}" SET idle_in_transaction_session_timeout = '${IDLE_IN_TX_TIMEOUT}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const role = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(`ALTER ROLE "${role}" RESET statement_timeout`);
    await queryRunner.query(`ALTER ROLE "${role}" RESET idle_in_transaction_session_timeout`);
  }
}
