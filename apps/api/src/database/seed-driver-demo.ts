/**
 * Provisionamento de DADOS DE DEMONSTRAÇÃO (dev) para o app do Motorista.
 * NÃO faz parte do runtime nem do seed padrão — é um utilitário LOCAL para
 * mostrar as features da FASE 2/3 com conteúdo real. No tenant demo, cria:
 * um usuário `driver`, um veículo, registros de manutenção (com lembretes),
 * lançamentos financeiros (custo/km, receita) e entregas concluídas (insights
 * de região/horário). Idempotente: se o motorista já existe, não faz nada.
 *
 *   npx ts-node src/database/seed-driver-demo.ts
 *
 * Credenciais criadas: driver@navix.test / ChangeMe123!
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv();
loadEnv({ path: '../../.env' });

const DRIVER = { email: 'driver@navix.test', password: 'ChangeMe123!' };

/** Data a `n` dias atrás, na `hourUtc` (UTC). */
function daysAgo(n: number, hourUtc = 10): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

async function main(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_DIRECT_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();

  const tenant = await client.query<{ id: string }>(
    `SELECT id FROM tenants WHERE name = $1 LIMIT 1`,
    ['Navix Demo'],
  );
  if (tenant.rowCount === 0) {
    throw new Error('Tenant "Navix Demo" não encontrado — rode `npm run seed` antes.');
  }
  const tenantId = tenant.rows[0].id;

  // Idempotência: se o motorista já existe, não re-provisiona (evita duplicar).
  const existing = await client.query(`SELECT id FROM users WHERE tenant_id=$1 AND email=$2`, [
    tenantId,
    DRIVER.email,
  ]);
  if (existing.rowCount && existing.rowCount > 0) {
    console.log(JSON.stringify({ ok: true, alreadyProvisioned: true, driver: DRIVER }, null, 2));
    await client.end();
    return;
  }

  // --- Usuário motorista ---
  const hash = await argon2.hash(DRIVER.password, { type: argon2.argon2id });
  await client.query(
    `INSERT INTO users (id, tenant_id, email, password_hash, status, roles) VALUES ($1,$2,$3,$4,'active',$5)`,
    [randomUUID(), tenantId, DRIVER.email, hash, ['driver']],
  );

  // --- Veículo ---
  const vehicleId = randomUUID();
  await client.query(
    `INSERT INTO vehicles (id, tenant_id, plate, type, capacity, status, odometer_km, created_at, updated_at)
     VALUES ($1,$2,$3,'car',4,'active',$4, now(), now())`,
    [vehicleId, tenantId, `AA-${Math.floor(1000 + Math.random() * 8999)}-BB`, 128500],
  );

  // --- Manutenção (gera lembretes: IPO vencido, seguro em breve, óleo por km) ---
  const maint = [
    { type: 'insurance', performed: daysAgo(360), odo: 118000, cost: 42000, dueDate: isoDay(daysAgo(-5)), dueKm: null },
    { type: 'ipo', performed: daysAgo(400), odo: 115000, cost: 3500, dueDate: isoDay(daysAgo(10)), dueKm: null },
    { type: 'oil_change', performed: daysAgo(40), odo: 123500, cost: 6500, dueDate: null, dueKm: 129000 },
    { type: 'tires', performed: daysAgo(120), odo: 119000, cost: 32000, dueDate: null, dueKm: null },
  ];
  for (const m of maint) {
    await client.query(
      `INSERT INTO vehicle_maintenance (id, tenant_id, vehicle_id, type, performed_at, odometer_km, cost_cents, next_due_date, next_due_odometer_km, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now())`,
      [randomUUID(), tenantId, vehicleId, m.type, isoDay(m.performed), m.odo, m.cost, m.dueDate, m.dueKm],
    );
  }

  // --- Finanças (2 abastecimentos p/ custo/km + receita/despesas) ---
  const fin = [
    { type: 'expense', category: 'fuel', cents: 6200, day: daysAgo(20), odo: 128000, liters: '41.20' },
    { type: 'expense', category: 'fuel', cents: 6450, day: daysAgo(5), odo: 128500, liters: '42.10' },
    { type: 'expense', category: 'toll', cents: 850, day: daysAgo(6), odo: null, liters: null },
    { type: 'expense', category: 'maintenance', cents: 6500, day: daysAgo(40), odo: null, liters: null },
    { type: 'income', category: 'delivery', cents: 48000, day: daysAgo(20), odo: null, liters: null },
    { type: 'income', category: 'delivery', cents: 52000, day: daysAgo(6), odo: null, liters: null },
  ];
  for (const f of fin) {
    await client.query(
      `INSERT INTO financial_entries (id, tenant_id, type, category, amount_cents, occurred_at, odometer_km, liters, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())`,
      [randomUUID(), tenantId, f.type, f.category, f.cents, isoDay(f.day), f.odo, f.liters],
    );
  }

  // --- Entregas concluídas (insights de região/horário + lucro/entrega) ---
  // [cidade, lat, lng, dias atrás, hora UTC]. Janela = conclusão + 2h (chk_deliveries_window).
  const done: [string, number, number, number, number][] = [
    ['Lisboa', 38.722, -9.139, 3, 9], ['Lisboa', 38.71, -9.14, 5, 9],
    ['Lisboa', 38.73, -9.15, 7, 10], ['Lisboa', 38.72, -9.13, 10, 9],
    ['Porto', 41.157, -8.629, 4, 14], ['Porto', 41.15, -8.61, 6, 14], ['Porto', 41.16, -8.62, 9, 15],
    ['Braga', 41.545, -8.426, 8, 16], ['Cascais', 38.697, -9.421, 11, 9],
  ];
  for (let i = 0; i < done.length; i++) {
    const [city, lat, lng, ago, hour] = done[i];
    const start = daysAgo(ago, hour);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO deliveries (id, tenant_id, street, number, city, state, postal_code, country, latitude, longitude, priority, window_start, window_end, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'0000-000','PT',$7,$8,'normal',$9,$10,'delivered',$9,$9)`,
      [randomUUID(), tenantId, `Rua ${i + 1}`, `${i + 10}`, city, city, lat, lng, start, end],
    );
  }

  console.log(JSON.stringify({ ok: true, tenantId, driver: DRIVER, vehicleId, deliveries: done.length }, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
