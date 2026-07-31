import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Medição do erro de ETA (ADR-0087) — a régua que faltava.
 *
 * ## Por que uma tabela, e não uma métrica só
 *
 * Hoje ninguém sabe o quanto o ETA erra: `route_plans` guarda a **previsão**
 * (`etaMinutes`) e o `audit_log` registra **quando** a entrega mudou de status,
 * mas nada liga os dois. Sem esse par não há denominador para dizer que um
 * modelo melhorou, nem exemplo rotulado para treiná-lo.
 *
 * Cada linha é as duas coisas ao mesmo tempo: uma medição (entra na métrica de
 * MAE) e um exemplo de treino. Por isso guarda também `cell` e `hour_of_week`
 * já materializados — são as duas features que a agregação coletiva (ADR-0031)
 * e o modelo de trânsito (ADR-0025) usam, e calculá-las na escrita evita
 * reprocessar o histórico inteiro a cada experimento.
 *
 * Retenção: **não** expurga. Diferente de `driver_positions` (90 dias, série
 * operacional), este é o corpus — é justamente o acúmulo que tem valor.
 */
export class EtaObservations1720003000000 implements MigrationInterface {
  name = 'EtaObservations1720003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE eta_observations (
        id                   uuid PRIMARY KEY,
        tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        delivery_id          uuid NOT NULL,
        -- Plano de onde saiu a previsão. Nulo quando a entrega terminou sem
        -- plano vigente (entrega avulsa) — aí só há o real, sem erro a medir.
        route_plan_id        uuid,
        predicted_arrival_at timestamptz,
        actual_arrival_at    timestamptz NOT NULL,
        -- real − previsto, em minutos. Positivo = chegou depois do prometido.
        -- Guardamos com sinal (e não o absoluto) para separar erro de viés:
        -- um ETA que atrasa sempre 10 min é um problema diferente de um que
        -- oscila ±10 min, e só o sinal distingue os dois.
        error_minutes        double precision,
        -- Como o instante real foi obtido, para não misturar qualidades de
        -- sinal na mesma média quando o POD entrar como fonte.
        source               text NOT NULL,
        -- Features materializadas na escrita (ver acima).
        cell                 text NOT NULL,
        hour_of_week         smallint NOT NULL,
        created_at           timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Uma medição por entrega: a conclusão é um evento único, e o listener pode
    // reprocessar o mesmo evento (retry, replay). O índice é a idempotência.
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_eta_observations_delivery ON eta_observations (tenant_id, delivery_id);`,
    );
    // Consulta do resumo: janela recente por tenant.
    await queryRunner.query(
      `CREATE INDEX idx_eta_observations_tenant_created ON eta_observations (tenant_id, created_at DESC);`,
    );

    await queryRunner.query(`ALTER TABLE eta_observations ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE eta_observations FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON eta_observations
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON eta_observations TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS eta_observations;`);
  }
}
