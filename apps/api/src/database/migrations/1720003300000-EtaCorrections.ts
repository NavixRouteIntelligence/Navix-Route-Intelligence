import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelo treinável de correção do ETA (ADR-0090).
 *
 * ## `eta_corrections` — os parâmetros do modelo
 *
 * Uma linha por (tenant, balde temporal): "neste contexto, costumamos atrasar N
 * minutos". Poucas linhas, lidas a cada previsão — por isso vivem em tabela
 * própria e não são recalculadas na leitura.
 *
 * Chaveado por **tenant e contexto**, não por célula: o viés da heurística é
 * sobretudo uma propriedade da operação (que frota, que região, que horários) e
 * não de um endereço específico. Por célula ficaria esparso demais para treinar,
 * e a cascata de baldes já dá o recorte que importa.
 *
 * ## `eta_observations.correction_minutes` — para o baseline não se perder
 *
 * Assim que o modelo entra em produção, `predicted_arrival_at` passa a ser a
 * previsão **já corrigida**, e `error_minutes` mede o erro do modelo — que é o
 * que queremos monitorar. Só que o treino seguinte precisa do resíduo da
 * **heurística crua**, senão o modelo passa a corrigir a própria correção e
 * entra em deriva.
 *
 * Guardar a correção aplicada mantém os dois recuperáveis:
 * `erro do baseline = error_minutes + correction_minutes`.
 */
export class EtaCorrections1720003300000 implements MigrationInterface {
  name = 'EtaCorrections1720003300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE eta_corrections (
        tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        bucket            text NOT NULL,
        samples           integer NOT NULL,
        correction_minutes double precision NOT NULL,
        trained_at        timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, bucket)
      );
    `);

    await queryRunner.query(`ALTER TABLE eta_corrections ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE eta_corrections FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON eta_corrections
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    // Correção aplicada na previsão que esta observação mediu. Nula/zero =
    // heurística crua (o estado antes de haver modelo).
    await queryRunner.query(
      `ALTER TABLE eta_observations ADD COLUMN correction_minutes double precision NOT NULL DEFAULT 0`,
    );

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON eta_corrections TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE eta_observations DROP COLUMN IF EXISTS correction_minutes;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS eta_corrections;`);
  }
}
