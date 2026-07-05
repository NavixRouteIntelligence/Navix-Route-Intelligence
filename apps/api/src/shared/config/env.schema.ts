import { z } from 'zod';

/**
 * Esquema de validação das variáveis de ambiente.
 * A aplicação falha rápido na inicialização se a configuração for inválida
 * (ver docs/architecture.md §9 e docs/security.md).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_GLOBAL_PREFIX: z.string().default('api'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(6432),
  DB_DIRECT_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1209600),

  ENCRYPTION_KEK: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

/** Valida `process.env` e retorna a configuração tipada. Lança em caso de erro. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  return parsed.data;
}
