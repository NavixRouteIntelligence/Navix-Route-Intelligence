import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

/**
 * DataSource do TypeORM usado pela CLI de migrações.
 *
 * IMPORTANTE: migrações conectam DIRETO ao Postgres (DB_DIRECT_PORT), não via
 * PgBouncer, pois DDL não deve passar pelo pooler em modo transaction
 * (ver docker/README.md e ADR-0005).
 */
loadEnv();
loadEnv({ path: '../../.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_DIRECT_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
  entities: ['src/modules/**/infrastructure/persistence/*.orm-entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'navix_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
