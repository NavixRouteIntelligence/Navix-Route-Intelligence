import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RLS em `api_keys` e `audit_log` (auditoria 5, R7 — ADR-0054).
 *
 * Ambas têm `tenant_id` e ficaram de fora do padrão de isolamento (ADR-0003):
 * o isolamento delas era só de aplicação. Um `audit_log` que vaze entre tenants
 * é um incidente de conformidade, então valem a defesa em profundidade.
 *
 * As políticas **não** seguem o molde de `tenant_isolation` das tabelas de
 * negócio, porque o padrão de acesso das duas é diferente:
 *
 * **audit_log** — o `AuditLogWriter` grava pelo repositório base (fora da
 * transação de tenant) e o `RolesGuard` audita negações de autorização *antes*
 * de qualquer interceptor rodar (guards precedem interceptors no Nest), ou seja,
 * sem `app.current_tenant` definido. Além disso o writer **engole exceções** por
 * design (auditoria não pode derrubar negócio). Uma política que barrasse esses
 * INSERTs faria a auditoria parar **em silêncio** — o pior resultado possível.
 * Por isso: INSERT sempre permitido; a proteção fica no **SELECT**, que é onde
 * mora o risco de vazamento. `tenant_id` nunca vem do cliente: é preenchido pelo
 * servidor a partir do contexto autenticado.
 *
 * Sem política de UPDATE/DELETE e com FORCE, o Postgres passa a **negar** os
 * dois para o role de runtime — tornando o append-only do `audit_log` uma
 * garantia do banco, e não mais "só por convenção" (docs/security.md §7.1).
 *
 * **api_keys** — a autenticação M2M precisa procurar a chave por `key_hash`
 * *antes* de saber o tenant (mesma restrição que mantém `users` sem RLS). Se o
 * SELECT exigisse contexto, o lookup pré-tenant devolveria vazio. Por isso o
 * SELECT é permitido sem contexto e isolado quando há contexto; a escrita
 * (gestão de chaves, sempre autenticada) é estritamente isolada.
 */
const EXPR = `NULLIF(current_setting('app.current_tenant', true), '')::uuid`;

export class RlsSensitiveTables1720002100000 implements MigrationInterface {
  name = 'RlsSensitiveTables1720002100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- audit_log ---
    await queryRunner.query(`ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;`);
    // Leitura isolada: linhas de sistema (tenant_id NULL) ficam invisíveis a
    // tenants; relatórios administrativos usam o owner, que contorna a RLS.
    await queryRunner.query(`
      CREATE POLICY audit_log_select ON audit_log
        FOR SELECT USING (tenant_id = ${EXPR});
    `);
    // Escrita sempre permitida — ver nota acima.
    await queryRunner.query(`
      CREATE POLICY audit_log_insert ON audit_log
        FOR INSERT WITH CHECK (true);
    `);

    // --- api_keys ---
    await queryRunner.query(`ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;`);
    // Sem contexto (lookup por key_hash na autenticação M2M): permitido.
    // Com contexto (gestão de chaves): só as do próprio tenant.
    await queryRunner.query(`
      CREATE POLICY api_keys_select ON api_keys
        FOR SELECT USING (${EXPR} IS NULL OR tenant_id = ${EXPR});
    `);
    await queryRunner.query(`
      CREATE POLICY api_keys_insert ON api_keys
        FOR INSERT WITH CHECK (tenant_id = ${EXPR});
    `);
    await queryRunner.query(`
      CREATE POLICY api_keys_update ON api_keys
        FOR UPDATE USING (tenant_id = ${EXPR}) WITH CHECK (tenant_id = ${EXPR});
    `);
    await queryRunner.query(`
      CREATE POLICY api_keys_delete ON api_keys
        FOR DELETE USING (tenant_id = ${EXPR});
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const policy of ['api_keys_select', 'api_keys_insert', 'api_keys_update', 'api_keys_delete']) {
      await queryRunner.query(`DROP POLICY IF EXISTS ${policy} ON api_keys;`);
    }
    await queryRunner.query(`ALTER TABLE api_keys NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;`);

    for (const policy of ['audit_log_select', 'audit_log_insert']) {
      await queryRunner.query(`DROP POLICY IF EXISTS ${policy} ON audit_log;`);
    }
    await queryRunner.query(`ALTER TABLE audit_log NO FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;`);
  }
}
