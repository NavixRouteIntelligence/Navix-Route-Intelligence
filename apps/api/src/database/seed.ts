import 'reflect-metadata';
import * as argon2 from 'argon2';
import { v7 as uuidv7 } from 'uuid';

import { AppDataSource } from './data-source';

/**
 * Seed de desenvolvimento: cria um tenant e um usuário admin de demonstração
 * para permitir login e testar os endpoints do Fleet. Idempotente.
 *
 * Uso:  npm run seed -w apps/api
 */
const DEMO = {
  tenantName: 'Navix Demo',
  email: 'admin@navix.test',
  password: 'ChangeMe123!',
  roles: ['admin', 'fleet_manager'],
};

async function main(): Promise<void> {
  const ds = await AppDataSource.initialize();
  try {
    // Tenant
    const existingTenant = await ds.query(`SELECT id FROM tenants WHERE name = $1 LIMIT 1`, [
      DEMO.tenantName,
    ]);
    let tenantId: string;
    if (existingTenant.length > 0) {
      tenantId = existingTenant[0].id;
    } else {
      tenantId = uuidv7();
      await ds.query(
        `INSERT INTO tenants (id, name, plan, region, status, slug) VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, DEMO.tenantName, 'pro', 'global', 'active', 'navix-demo'],
      );
    }

    // Usuário admin
    const existingUser = await ds.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
      [tenantId, DEMO.email],
    );
    if (existingUser.length === 0) {
      const passwordHash = await argon2.hash(DEMO.password, { type: argon2.argon2id });
      await ds.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, status, roles)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuidv7(), tenantId, DEMO.email, passwordHash, 'active', DEMO.roles],
      );
    }

    // eslint-disable-next-line no-console
    console.log('\nSeed concluído. Credenciais de desenvolvimento:');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ tenantId, email: DEMO.email, password: DEMO.password }, null, 2));
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha no seed:', err);
  process.exit(1);
});
