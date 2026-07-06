import { randomUUID } from 'node:crypto';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

/**
 * Prova de isolamento multi-tenant no NÍVEL DO BANCO (RLS). Requer Docker/Postgres
 * no ar e as migrações aplicadas (inclui FORCE ROW LEVEL SECURITY).
 *
 * A conexão é feita como OWNER das tabelas; como a RLS está FORÇADA, nem o owner
 * enxerga linhas de outro tenant sem `app.current_tenant` correspondente.
 */
loadEnv();
loadEnv({ path: '../../.env' });

const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const DELIVERY_A = randomUUID();

/**
 * Conecta como o role de RUNTIME (não-superusuário) — é ele que fica sujeito à
 * RLS. Se conectasse como o owner/superusuário, a RLS seria ignorada.
 */
function makeDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_DIRECT_PORT ?? 5432),
    username: process.env.DB_APP_USER ?? 'navix_app',
    password: process.env.DB_APP_PASSWORD ?? 'navix_app_password',
    database: process.env.DB_NAME ?? 'navix',
    entities: [],
  });
}

async function setTenant(manager: { query: (q: string, p?: unknown[]) => Promise<unknown> }, tenantId: string) {
  await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
}

describe('Isolamento multi-tenant via RLS (integração)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await makeDataSource().initialize();
    await ds.query(`INSERT INTO tenants (id, name) VALUES ($1,$2),($3,$4)`, [
      TENANT_A,
      `iso-A-${TENANT_A}`,
      TENANT_B,
      `iso-B-${TENANT_B}`,
    ]);
    // Insere uma entrega para o tenant A, dentro de uma transação com o tenant setado.
    await ds.transaction(async (m) => {
      await setTenant(m, TENANT_A);
      await m.query(
        `INSERT INTO deliveries
          (id, tenant_id, street, number, city, state, postal_code, country,
           latitude, longitude, window_start, window_end)
         VALUES ($1,$2,'Rua X','1','SP','SP','00000','BR',0,0, now(), now() + interval '1 hour')`,
        [DELIVERY_A, TENANT_A],
      );
    });
  });

  afterAll(async () => {
    if (!ds?.isInitialized) return;
    await ds.transaction(async (m) => {
      await setTenant(m, TENANT_A);
      await m.query(`DELETE FROM deliveries WHERE id = $1`, [DELIVERY_A]);
    });
    await ds.query(`DELETE FROM tenants WHERE id IN ($1,$2)`, [TENANT_A, TENANT_B]);
    await ds.destroy();
  });

  it('o tenant B NÃO enxerga a entrega do tenant A', async () => {
    const rows = await ds.transaction(async (m) => {
      await setTenant(m, TENANT_B);
      return m.query(`SELECT id FROM deliveries WHERE id = $1`, [DELIVERY_A]);
    });
    expect(rows).toHaveLength(0);
  });

  it('o tenant A enxerga a própria entrega', async () => {
    const rows = await ds.transaction(async (m) => {
      await setTenant(m, TENANT_A);
      return m.query(`SELECT id FROM deliveries WHERE id = $1`, [DELIVERY_A]);
    });
    expect(rows).toHaveLength(1);
  });

  it('sem app.current_tenant, nenhuma linha é visível (RLS forçada)', async () => {
    const rows = await ds.transaction(async (m) => {
      return m.query(`SELECT id FROM deliveries WHERE id = $1`, [DELIVERY_A]);
    });
    expect(rows).toHaveLength(0);
  });
});
