import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O read model diário passa a ter **sujeito**, e a atividade passa a poder ser
 * desconhecida (ADR-0117).
 *
 * ## Porquê
 *
 * `driver_kpi_daily` nasceu com `driver_id NOT NULL` — a **ficha** do motorista
 * (ADR-0086). O motorista autónomo não tem ficha (ADR-0085), e a projeção que
 * alimenta a tabela filtra `driver_id IS NOT NULL`: ele não tinha linha
 * nenhuma, e a tela dele caía no rollup do tenant, sem `active_minutes`
 * (ADR-0116). A tabela feita para o resumo por motorista não servia
 * precisamente quem trabalha sozinho.
 *
 * Agora o sujeito de um dia é uma **pessoa**, identificada pela ficha quando
 * existe e pelo **login** quando não existe. Exatamente uma das duas colunas
 * está preenchida, e o banco recusa qualquer outra combinação.
 *
 * ## `active_minutes` sai; os limites entram
 *
 * A coluna era `NOT NULL DEFAULT 0`, e zero dizia duas coisas incompatíveis:
 * "não trabalhou" e "não sabemos". Passam a ficar gravados os **instantes
 * crus** — primeira e última atividade —, e os minutos são derivados na
 * leitura. Sem limites, a duração é `null`, e nunca zero: um dia com uma só
 * atividade registada não tem duração conhecida, e inventar uma seria fabricar
 * jornada.
 *
 * ## `projected_at`
 *
 * Distingue "projetado, e não houve trabalho" de "ainda não projetado". Sem
 * isto, a ausência de linha é ambígua e a tela mostra um dia vazio que pode ser
 * apenas atraso da projeção.
 *
 * A tabela é um read model recomponível — e estava vazia — pelo que a migração
 * não preserva dados: a reconciliação da ADR-0092 reconstrói a janela visível.
 */
export class DriverDailySubject1720005200000 implements MigrationInterface {
  name = 'DriverDailySubject1720005200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP CONSTRAINT driver_kpi_daily_pkey;`);
    await queryRunner.query(`ALTER TABLE driver_kpi_daily ALTER COLUMN driver_id DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE driver_kpi_daily ADD COLUMN user_id uuid;`);

    // Exatamente um sujeito por linha. Sem isto, uma linha com os dois ids
    // pertenceria a duas pessoas, e uma linha sem nenhum a ninguém.
    await queryRunner.query(`
      ALTER TABLE driver_kpi_daily
        ADD CONSTRAINT chk_driver_kpi_subject
        CHECK ((driver_id IS NULL) <> (user_id IS NULL));
    `);

    // `NULLS NOT DISTINCT` (PG 15+) é o que torna a chave utilizável: sem isso,
    // duas linhas do mesmo autónomo no mesmo dia não colidiriam (`driver_id`
    // nulo nunca é igual a `driver_id` nulo) e a projeção duplicaria em vez de
    // atualizar.
    await queryRunner.query(`
      ALTER TABLE driver_kpi_daily
        ADD CONSTRAINT driver_kpi_daily_subject_key
        UNIQUE NULLS NOT DISTINCT (tenant_id, driver_id, user_id, day);
    `);

    // Instantes crus da atividade; os minutos são derivados na leitura.
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP COLUMN active_minutes;`);
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily ADD COLUMN first_activity_at timestamptz;`,
    );
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily ADD COLUMN last_activity_at timestamptz;`,
    );

    // Poupança atribuível: só entra quando o plano é da pessoa (ADR-0117).
    // `NULL` = sem plano atribuível no dia, que é diferente de "poupou zero".
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily ADD COLUMN plans integer NOT NULL DEFAULT 0;`,
    );
    await queryRunner.query(`ALTER TABLE driver_kpi_daily ADD COLUMN saved_km double precision;`);
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily ADD COLUMN saved_minutes double precision;`,
    );
    // Combustível **não** é gravado: sai de constantes por tipo de veículo
    // (`CONSUMPTION_PER_100KM`), e gravá-lo congelaria uma estimativa como se
    // fosse facto. Grava-se o ingrediente cru — que tipos de veículo houve no
    // dia —, e a estimativa é derivada na leitura, só quando há um tipo só.
    await queryRunner.query(`ALTER TABLE driver_kpi_daily ADD COLUMN vehicle_types text[];`);

    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily ADD COLUMN projected_at timestamptz NOT NULL DEFAULT now();`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS idx_driver_kpi_range;`);
    await queryRunner.query(`
      CREATE INDEX idx_driver_kpi_range
        ON driver_kpi_daily (tenant_id, driver_id, user_id, day DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM driver_kpi_daily WHERE driver_id IS NULL;`);
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily DROP CONSTRAINT IF EXISTS driver_kpi_daily_subject_key;`,
    );
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily DROP CONSTRAINT IF EXISTS chk_driver_kpi_subject;`,
    );
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP COLUMN IF EXISTS user_id;`);
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily DROP COLUMN IF EXISTS first_activity_at;`,
    );
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP COLUMN IF EXISTS last_activity_at;`);
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP COLUMN IF EXISTS plans;`);
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP COLUMN IF EXISTS saved_km;`);
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP COLUMN IF EXISTS saved_minutes;`);
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP COLUMN IF EXISTS vehicle_types;`);
    await queryRunner.query(`ALTER TABLE driver_kpi_daily DROP COLUMN IF EXISTS projected_at;`);
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily ADD COLUMN active_minutes integer NOT NULL DEFAULT 0;`,
    );
    await queryRunner.query(`ALTER TABLE driver_kpi_daily ALTER COLUMN driver_id SET NOT NULL;`);
    await queryRunner.query(
      `ALTER TABLE driver_kpi_daily ADD CONSTRAINT driver_kpi_daily_pkey PRIMARY KEY (tenant_id, driver_id, day);`,
    );
  }
}
