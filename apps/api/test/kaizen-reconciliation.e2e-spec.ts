import { randomUUID } from 'node:crypto';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { transactionContext } from '../src/shared/database/transaction-context';
import { DriverKpiRepository } from '../src/modules/analytics/infrastructure/persistence/driver-kpi.repository';
import {
  activeMinutesOf,
  onTimeRateOf,
  successRateOf,
} from '../src/modules/analytics/domain/daily-subject';

/**
 * Reconciliação do Kaizen (ADR-0123): o que a tela mostra tem de sair das
 * linhas que o produziram.
 *
 * O teste semeia um **dataset sintético** com os seis casos que a T7.9 nomeia —
 * dia bom, dia com falhas, folga, pouco histórico, projeção atrasada e métricas
 * nulas —, corre a **projeção real** e compara o read model com a soma feita à
 * mão sobre as entregas. Se divergirem, o defeito está na projeção, não aqui.
 *
 * Requer Postgres com as migrações aplicadas.
 */
loadEnv();
loadEnv({ path: '../../.env' });

const TENANT = randomUUID();
const LOGIN = randomUUID();

/** Conecta como o role de RUNTIME — é ele que fica sujeito à RLS. */
function makeDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_DIRECT_PORT ?? 5432),
    username: process.env.DB_APP_USER ?? 'navix_app',
    password: process.env.DB_APP_PASSWORD ?? 'navix_app_password',
    database: process.env.DB_NAME ?? 'navix',
  });
}

/** Um dia do dataset: quantas entregues, quantas falhadas, quantas na janela. */
interface DiaSintetico {
  offset: number;
  delivered: number;
  failed: number;
  onTime: number;
  /** Minutos entre a primeira e a última atividade; `null` = uma só atividade. */
  spanMinutes: number | null;
}

const DATASET: Record<string, DiaSintetico> = {
  // Dia bom: tudo concluído e dentro da janela.
  bom: { offset: 1, delivered: 12, failed: 0, onTime: 12, spanMinutes: 300 },
  // Dia com falhas: parte por concluir, parte fora da janela.
  falhas: { offset: 2, delivered: 8, failed: 3, onTime: 5, spanMinutes: 420 },
  // Folga: nenhuma entrega finalizada.
  folga: { offset: 3, delivered: 0, failed: 0, onTime: 0, spanMinutes: null },
  // Métricas nulas: uma só atividade — não há duração conhecida.
  semDuracao: { offset: 4, delivered: 1, failed: 0, onTime: 1, spanMinutes: null },
};

describe('Kaizen — reconciliação com a fonte (integração)', () => {
  let ds: DataSource;
  let repo: DriverKpiRepository;

  const diaDe = (offset: number): string => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    ds = await makeDataSource().initialize();
    repo = new DriverKpiRepository(ds as never);

    const owner = await new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_DIRECT_PORT ?? 5432),
      username: process.env.DB_USER ?? 'navix',
      password: process.env.DB_PASSWORD ?? 'navix',
      database: process.env.DB_NAME ?? 'navix',
    }).initialize();

    // Tenant de tipo `driver`: é o que faz o sujeito sem ficha existir.
    await owner.query(
      `INSERT INTO tenants (id, name, slug, account_type, time_zone)
       VALUES ($1, 'Kaizen Reconciliação', $2, 'driver', 'UTC')`,
      [TENANT, `kaizen-${TENANT.slice(0, 8)}`],
    );
    await owner.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, roles)
       VALUES ($1, $2, $3, 'x', ARRAY['driver'])`,
      [LOGIN, TENANT, `rec-${LOGIN}@navix.test`],
    );

    for (const dia of Object.values(DATASET)) {
      const day = diaDe(dia.offset);
      const total = dia.delivered + dia.failed;
      for (let i = 0; i < total; i++) {
        const entregue = i < dia.delivered;
        const naJanela = entregue && i < dia.onTime;
        // `span` distribuído entre a primeira e a última atividade.
        const minutos = total > 1 && dia.spanMinutes ? (dia.spanMinutes * i) / (total - 1) : 0;
        await owner.query(
          `INSERT INTO deliveries (id, tenant_id, street, number, city, state, postal_code,
                                   country, latitude, longitude, window_start, window_end,
                                   status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, 'Rua', $2, 'Lisboa', 'Lisboa', '1100-001', 'PT',
                   38.7, -9.1,
                   $3::date + time '08:00', $3::date + time '18:00',
                   $4, $3::date + time '07:00', $3::date + time '08:00' + ($5 || ' minutes')::interval)`,
          [
            TENANT,
            String(i),
            day,
            entregue ? 'delivered' : 'failed',
            // Fora da janela: depois das 18h.
            naJanela || !entregue ? String(minutos) : String(11 * 60),
          ],
        );
      }
    }
    await owner.destroy();

    // Projeção **real**, no mesmo caminho que a reconciliação usa em produção.
    for (const dia of Object.values(DATASET)) {
      await ds.transaction(async (m) => {
        await m.query("SELECT set_config('app.current_tenant', $1, true)", [TENANT]);
        await transactionContext.run(m, () => repo.rebuildDay(TENANT, diaDe(dia.offset)));
      });
    }
  });

  afterAll(async () => {
    const owner = await new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_DIRECT_PORT ?? 5432),
      username: process.env.DB_USER ?? 'navix',
      password: process.env.DB_PASSWORD ?? 'navix',
      database: process.env.DB_NAME ?? 'navix',
    }).initialize();
    await owner.query('DELETE FROM tenants WHERE id = $1', [TENANT]);
    await owner.destroy();
    await ds.destroy();
  });

  async function ler(day: string) {
    return ds.transaction(async (m) => {
      await m.query("SELECT set_config('app.current_tenant', $1, true)", [TENANT]);
      return transactionContext.run(m, () =>
        repo.range(TENANT, { kind: 'user', userId: LOGIN }, day, day),
      );
    });
  }

  it.each(Object.entries(DATASET))('reconcilia o dia «%s» com as entregas', async (_nome, dia) => {
    const [linha] = await ler(diaDe(dia.offset));

    expect(linha.delivered).toBe(dia.delivered);
    expect(linha.failed).toBe(dia.failed);
    expect(linha.onTime).toBe(dia.onTime);
  });

  it('as taxas derivam das contagens, e não são gravadas', async () => {
    const [linha] = await ler(diaDe(DATASET.falhas.offset));

    expect(successRateOf(linha)).toBeCloseTo(8 / 11);
    expect(onTimeRateOf(linha)).toBeCloseTo(5 / 8);
  });

  // Sem denominador não há taxa: `null`, nunca 0%.
  it('folga não produz taxa nenhuma', async () => {
    const [linha] = await ler(diaDe(DATASET.folga.offset));

    expect(linha.delivered).toBe(0);
    expect(successRateOf(linha)).toBeNull();
    expect(onTimeRateOf(linha)).toBeNull();
  });

  it('uma atividade só não vira duração', async () => {
    const [linha] = await ler(diaDe(DATASET.semDuracao.offset));

    expect(activeMinutesOf(linha)).toBeNull();
  });

  it('a duração sai dos limites gravados, não de uma estimativa', async () => {
    const [linha] = await ler(diaDe(DATASET.bom.offset));

    expect(activeMinutesOf(linha)).toBe(DATASET.bom.spanMinutes);
  });

  // Recompor é idempotente: correr outra vez não pode inflar nem duplicar.
  it('recompor o mesmo dia não muda nada', async () => {
    const day = diaDe(DATASET.falhas.offset);
    const antes = await ler(day);

    await ds.transaction(async (m) => {
      await m.query("SELECT set_config('app.current_tenant', $1, true)", [TENANT]);
      await transactionContext.run(m, () => repo.rebuildDay(TENANT, day));
    });
    const depois = await ler(day);

    expect(depois).toHaveLength(1);
    expect({ ...depois[0], projectedAt: null }).toEqual({ ...antes[0], projectedAt: null });
  });

  // Projeção atrasada: o dia existe na fonte e ainda não foi projetado.
  it('dia por projetar não tem linha — e isso é distinguível de folga', async () => {
    const naoProjetado = diaDe(10);

    expect(await ler(naoProjetado)).toHaveLength(0);
    // A folga **tem** linha, com zeros: é «projetado e não houve trabalho».
    expect(await ler(diaDe(DATASET.folga.offset))).toHaveLength(1);
  });
});
