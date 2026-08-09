import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feedback e preferências do Kaizen (ADR-0121).
 *
 * ## O que estas tabelas NÃO são
 *
 * Não são avaliação de ninguém. Ficam **fora** de `driver_kpi_daily` e de
 * `kpi_daily` de propósito: nenhum número de desempenho é derivado daqui, e a
 * separação física é o que impede que alguém, mais tarde, faça um `JOIN` e
 * comece a medir «aderência às sugestões». O feedback serve a uma coisa só —
 * escolher melhor a próxima sugestão **da mesma pessoa**.
 *
 * ## Sem texto livre
 *
 * `reason` é um enum curto. Texto livre convidaria a desabafo, e desabafo num
 * campo que a empresa lê é outra promessa — que este produto não faz. Se um dia
 * fizer, é decisão de produto e de privacidade, não um `varchar`.
 *
 * ## Retenção
 *
 * 180 dias, documentado em `docs/database.md §8`. É o suficiente para a regra
 * de relevância (que olha 14 dias) e para o histórico que o motorista vê;
 * guardar mais tempo seria acumular opinião sem finalidade.
 */
export class KaizenFeedback1720005400000 implements MigrationInterface {
  name = 'KaizenFeedback1720005400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE kaizen_feedback (
        tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        -- O **login**, como no read model do autónomo (ADR-0117). O feedback é
        -- de quem lê o resumo, e quem lê é sempre uma pessoa autenticada.
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day        date NOT NULL,
        -- Código da recomendação a que este feedback responde (ADR-0119).
        code       text NOT NULL,
        verdict    text NOT NULL CHECK (verdict IN ('useful', 'not-applicable')),
        -- Só faz sentido com 'not-applicable', e é sempre um dos quatro.
        reason     text CHECK (reason IN ('wrong-data', 'already-done', 'out-of-context', 'other')),
        created_at timestamptz NOT NULL DEFAULT now(),
        -- Um feedback por dia por pessoa: mudar de ideias substitui, não soma.
        PRIMARY KEY (tenant_id, user_id, day)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_kaizen_feedback_recent
        ON kaizen_feedback (tenant_id, user_id, day DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE kaizen_preferences (
        tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        -- Esconde as **sugestões**, nunca os resultados (ADR-0121). Quem não
        -- quer conselho continua a ver o que fez.
        hide_recommendations  boolean NOT NULL DEFAULT false,
        updated_at            timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, user_id)
      );
    `);

    for (const tabela of ['kaizen_feedback', 'kaizen_preferences']) {
      await queryRunner.query(`ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${tabela} FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${tabela}
          USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
      `);
      const appUser = process.env.DB_APP_USER ?? 'navix_app';
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${tabela} TO ${appUser};`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS kaizen_preferences;`);
    await queryRunner.query(`DROP TABLE IF EXISTS kaizen_feedback;`);
  }
}
