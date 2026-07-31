import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Read model diário de KPIs (ADR-0092) — o primeiro do sistema.
 *
 * ## O que havia antes
 *
 * Nenhum read model. O dashboard buscava quatro listas paginadas do OLTP
 * (`pageSize: 100`) e somava **no navegador**. Como consequência, "economia de
 * combustível", "distância otimizada" e "score médio" refletiam apenas as 100
 * rotas mais recentes, enquanto "Entregas" e "Rotas otimizadas" mostravam o
 * total real — a mesma tela misturava número verdadeiro com soma truncada, sem
 * sinalizar, e o erro crescia com o uso.
 *
 * ## Por que rollup diário
 *
 * O dia é a menor granularidade que qualquer KPI de operação usa, e agrega
 * ~1 linha por tenant por dia: um ano de histórico cabe em centenas de linhas.
 * O cálculo sai do caminho de leitura e vira uma varredura por índice.
 *
 * ## Sobre TimescaleDB
 *
 * O ADR-0009 previa hypertable para série temporal, mas a extensão **não está
 * disponível**: dev roda `postgis/postgis:16-3.4` e produção é RDS, que não
 * suporta Timescale. Adotá-la exigiria trocar o provedor de banco — decisão de
 * plataforma, não desta entrega.
 *
 * O esquema aqui é **exatamente** o que uma hypertable teria (chave temporal +
 * índice por tenant e dia), então convertê-la depois é uma migração de uma
 * linha. Nada aqui aposta contra o Timescale; apenas não depende dele.
 */
export class KpiDaily1720003400000 implements MigrationInterface {
  name = 'KpiDaily1720003400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE kpi_daily (
        tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        day           date NOT NULL,
        -- Otimização: a economia nasce no plano de rota.
        plans         integer NOT NULL DEFAULT 0,
        saved_km      double precision NOT NULL DEFAULT 0,
        optimized_km  double precision NOT NULL DEFAULT 0,
        score_sum     double precision NOT NULL DEFAULT 0,
        -- Execução: base da taxa de sucesso e do on-time.
        delivered     integer NOT NULL DEFAULT 0,
        failed        integer NOT NULL DEFAULT 0,
        canceled      integer NOT NULL DEFAULT 0,
        -- Concluídas dentro da janela. Denominador é "delivered", não o total:
        -- uma entrega que falhou não é "fora do prazo", é outra coisa.
        on_time       integer NOT NULL DEFAULT 0,
        -- Despesa do dia, base do custo por entrega.
        expense       numeric(12, 2) NOT NULL DEFAULT 0,
        updated_at    timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, day)
      );
    `);

    // A leitura é sempre uma janela de dias de um tenant.
    await queryRunner.query(
      `CREATE INDEX idx_kpi_daily_range ON kpi_daily (tenant_id, day DESC);`,
    );

    await queryRunner.query(`ALTER TABLE kpi_daily ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE kpi_daily FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON kpi_daily
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_daily TO ${appUser};`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS kpi_daily;`);
  }
}
