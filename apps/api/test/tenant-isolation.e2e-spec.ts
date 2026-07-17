import { randomUUID } from 'node:crypto';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { AuditLogWriter } from '../src/shared/audit/audit-log.writer';
import { AuditLogOrmEntity } from '../src/shared/audit/audit-log.orm-entity';

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
const AUDIT_A = randomUUID();
const AUDIT_B = randomUUID();
const AUDIT_SISTEMA = randomUUID();
const KEY_A = randomUUID();
const KEY_B = randomUUID();
const KEY_HASH_B = `hash-b-${TENANT_B}`;

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
    entities: [AuditLogOrmEntity],
  });
}

async function setTenant(manager: { query: (q: string, p?: unknown[]) => Promise<unknown> }, tenantId: string) {
  await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
}

describe('Isolamento multi-tenant via RLS (integração)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await makeDataSource().initialize();
    // `slug` é NOT NULL desde ADR-0016; deriva do id para garantir unicidade.
    await ds.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3),($4,$5,$6)`, [
      TENANT_A,
      `iso-A-${TENANT_A}`,
      `iso-a-${TENANT_A.slice(0, 8)}`,
      TENANT_B,
      `iso-B-${TENANT_B}`,
      `iso-b-${TENANT_B.slice(0, 8)}`,
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

    // audit_log (ADR-0054): INSERT é permitido sem contexto — é assim que o
    // AuditLogWriter e o RolesGuard gravam de verdade.
    await ds.query(
      `INSERT INTO audit_log (id, tenant_id, actor_id, action, resource, metadata)
       VALUES ($1,$2,NULL,'iso.a','r','{}'),($3,$4,NULL,'iso.b','r','{}'),
              ($5,NULL,NULL,'iso.sistema','r','{}')`,
      [AUDIT_A, TENANT_A, AUDIT_B, TENANT_B, AUDIT_SISTEMA],
    );

    // api_keys (ADR-0054): escrita exige contexto do próprio tenant.
    for (const [id, tenant, hash] of [
      [KEY_A, TENANT_A, `hash-a-${TENANT_A}`],
      [KEY_B, TENANT_B, KEY_HASH_B],
    ]) {
      await ds.transaction(async (m) => {
        await setTenant(m, tenant);
        await m.query(`INSERT INTO api_keys (id, tenant_id, name, key_hash) VALUES ($1,$2,$3,$4)`, [
          id,
          tenant,
          `key-${tenant}`,
          hash,
        ]);
      });
    }
  });

  afterAll(async () => {
    if (!ds?.isInitialized) return;
    await ds.transaction(async (m) => {
      await setTenant(m, TENANT_A);
      await m.query(`DELETE FROM deliveries WHERE id = $1`, [DELIVERY_A]);
    });
    // audit_log é append-only para o role de runtime (sem política de DELETE):
    // a limpeza usa o owner, via a conexão de migração.
    await ds.destroy();

    const owner = await new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_DIRECT_PORT ?? 5432),
      username: process.env.DB_USER ?? 'navix',
      password: process.env.DB_PASSWORD ?? 'navix_dev_password',
      database: process.env.DB_NAME ?? 'navix',
      entities: [],
    }).initialize();
    await owner.query(`DELETE FROM audit_log WHERE id IN ($1,$2,$3)`, [
      AUDIT_A,
      AUDIT_B,
      AUDIT_SISTEMA,
    ]);
    // Linhas criadas pelos testes de INSERT sem contexto e pelo writer real.
    await owner.query(`DELETE FROM audit_log WHERE action IN ('iso.sem-contexto', 'iso.writer')`);
    await owner.query(`DELETE FROM api_keys WHERE id IN ($1,$2)`, [KEY_A, KEY_B]);
    await owner.query(`DELETE FROM tenants WHERE id IN ($1,$2)`, [TENANT_A, TENANT_B]);
    await owner.destroy();
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

  describe('audit_log (ADR-0054)', () => {
    it('o tenant A só enxerga a própria auditoria (nem a de B, nem a de sistema)', async () => {
      const rows = await ds.transaction(async (m) => {
        await setTenant(m, TENANT_A);
        return m.query(`SELECT action FROM audit_log WHERE id IN ($1,$2,$3)`, [
          AUDIT_A,
          AUDIT_B,
          AUDIT_SISTEMA,
        ]);
      });
      expect(rows).toEqual([{ action: 'iso.a' }]);
    });

    it('aceita INSERT sem contexto de tenant', async () => {
      // O AuditLogWriter grava pelo repositório base e o RolesGuard audita antes
      // dos interceptors — ambos fora da transação de tenant. Barrar esses
      // INSERTs faria a auditoria parar em silêncio (o writer engole exceções).
      const id = randomUUID();
      await ds.query(
        `INSERT INTO audit_log (id, tenant_id, actor_id, action, resource, metadata)
         VALUES ($1,$2,NULL,'iso.sem-contexto','r','{}')`,
        [id, TENANT_A],
      );

      const rows = await ds.transaction(async (m) => {
        await setTenant(m, TENANT_A);
        return m.query(`SELECT action FROM audit_log WHERE id = $1`, [id]);
      });
      expect(rows).toHaveLength(1);
    });

    it('o AuditLogWriter grava sem contexto de tenant (regressão do RETURNING × RLS)', async () => {
      // Regressão do ADR-0054: a política de SELECT torna `INSERT ... RETURNING`
      // inválido sem contexto de tenant. O writer usava `save()` (que faz
      // RETURNING para recarregar defaults), então TODA a auditoria falhava em
      // silêncio (o writer engole exceções). Aqui exercitamos o writer REAL.
      const writer = new AuditLogWriter(ds.getRepository(AuditLogOrmEntity));
      await writer.record({
        tenantId: TENANT_A,
        actorId: null,
        action: 'iso.writer',
        resource: 'r',
        metadata: { via: 'writer' },
      });

      const rows = await ds.transaction(async (m) => {
        await setTenant(m, TENANT_A);
        return m.query(`SELECT action FROM audit_log WHERE action = 'iso.writer'`);
      });
      expect(rows).toEqual([{ action: 'iso.writer' }]);
    });

    it('é append-only para o role de runtime: UPDATE e DELETE não afetam nada', async () => {
      await ds.transaction(async (m) => {
        await setTenant(m, TENANT_A);
        await m.query(`UPDATE audit_log SET action = 'adulterado' WHERE id = $1`, [AUDIT_A]);
        await m.query(`DELETE FROM audit_log WHERE id = $1`, [AUDIT_A]);
      });

      const rows = await ds.transaction(async (m) => {
        await setTenant(m, TENANT_A);
        return m.query(`SELECT action FROM audit_log WHERE id = $1`, [AUDIT_A]);
      });
      expect(rows).toEqual([{ action: 'iso.a' }]);
    });
  });

  describe('api_keys (ADR-0054)', () => {
    it('permite o lookup por key_hash sem contexto (autenticação M2M)', async () => {
      // A chave precisa ser encontrada ANTES de o tenant ser conhecido — mesma
      // restrição que mantém `users` sem RLS.
      const rows = await ds.query(`SELECT tenant_id FROM api_keys WHERE key_hash = $1`, [
        KEY_HASH_B,
      ]);
      expect(rows).toEqual([{ tenant_id: TENANT_B }]);
    });

    it('o tenant A não enxerga a chave do tenant B', async () => {
      const rows = await ds.transaction(async (m) => {
        await setTenant(m, TENANT_A);
        return m.query(`SELECT id FROM api_keys WHERE id = $1`, [KEY_B]);
      });
      expect(rows).toHaveLength(0);
    });

    it('o tenant A não consegue criar chave para o tenant B', async () => {
      await expect(
        ds.transaction(async (m) => {
          await setTenant(m, TENANT_A);
          return m.query(
            `INSERT INTO api_keys (id, tenant_id, name, key_hash) VALUES ($1,$2,'invasora',$3)`,
            [randomUUID(), TENANT_B, `hash-x-${TENANT_B}`],
          );
        }),
      ).rejects.toThrow(/row-level security/i);
    });

    it('o tenant A não consegue revogar a chave do tenant B', async () => {
      await ds.transaction(async (m) => {
        await setTenant(m, TENANT_A);
        await m.query(`UPDATE api_keys SET revoked_at = now() WHERE id = $1`, [KEY_B]);
      });

      const rows = await ds.query(`SELECT revoked_at FROM api_keys WHERE id = $1`, [KEY_B]);
      expect(rows[0].revoked_at).toBeNull();
    });
  });
});
