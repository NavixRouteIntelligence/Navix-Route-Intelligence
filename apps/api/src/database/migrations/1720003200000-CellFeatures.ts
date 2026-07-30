import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Features materializadas por célula e contexto temporal (ADR-0089).
 *
 * ## Por que materializar
 *
 * A agregação coletiva era feita **a cada leitura**: até 2000 observações
 * buscadas, agrupadas e medianizadas por consulta — e o otimizador consulta uma
 * vez por parada de cada rota. O custo cresce com o histórico, que é justamente
 * o ativo que queremos acumular: quanto melhor o dado, mais lenta a leitura.
 *
 * Aqui o cálculo acontece **na escrita**, uma célula por vez, e a leitura vira
 * uma busca por chave. É o que permite o histórico crescer sem penalizar quem
 * otimiza rota.
 *
 * ## Features, não rótulos
 *
 * Esta tabela guarda o que se sabe sobre um lugar num contexto (X). O que de
 * fato aconteceu (y) mora em `eta_observations` (ADR-0087). Separados de
 * propósito: são ciclos de vida diferentes, e o treino os junta na hora certa.
 */
export class CellFeatures1720003200000 implements MigrationInterface {
  name = 'CellFeatures1720003200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE cell_features (
        tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        cell               text NOT NULL,
        -- 'all' | 'dp:<util|fds>:<periodo>' | 'hw:<0..167>' — do mais geral ao
        -- mais específico. A leitura desce a cascata (ver domain/cell-features).
        bucket             text NOT NULL,
        samples            integer NOT NULL,
        service_minutes_p50 double precision NOT NULL,
        updated_at         timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, cell, bucket)
      );
    `);

    // A leitura pede várias células de uma vez (uma por parada da rota).
    await queryRunner.query(
      `CREATE INDEX idx_cell_features_lookup ON cell_features (tenant_id, cell);`,
    );

    await queryRunner.query(`ALTER TABLE cell_features ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE cell_features FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON cell_features
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON cell_features TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cell_features;`);
  }
}
