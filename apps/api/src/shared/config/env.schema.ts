import { z } from 'zod';

/** Senha do role de runtime usada apenas em dev/test (rejeitada em produção). */
export const DEV_APP_PASSWORD = 'navix_app_password';

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
  // Owner/superusuário — usado por migrações e seed (bypassa RLS).
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  // Role de runtime da aplicação — NÃO superusuário, sujeito à RLS.
  DB_APP_USER: z.string().default('navix_app'),
  // O default só vale fora de produção; `assertProductionConfig` o rejeita lá.
  DB_APP_PASSWORD: z.string().default(DEV_APP_PASSWORD),
  DB_NAME: z.string().min(1),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1209600),

  // RS256 (assimétrico). Se ausentes em dev, um par efêmero é gerado no boot.
  // Em produção, forneça as chaves via secret manager (ver docs/security.md §4).
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_KEY_ID: z.string().optional(),
  // Rotação: chave pública anterior (apenas verificação).
  JWT_PREVIOUS_PUBLIC_KEY: z.string().optional(),
  JWT_PREVIOUS_KEY_ID: z.string().optional(),

  ENCRYPTION_KEK: z.string().min(16),

  // Geocodificação do Import Center (Mapbox). Opcional: sem token, o geocoder
  // retorna nulo e linhas sem lat/lng ficam inválidas.
  MAPBOX_TOKEN: z.string().optional(),

  // --- Object storage (mídia do POD — ADR-0019) ---
  // `local` (padrão, dev): grava em disco e serve por /api/v1/files.
  // `s3`: bucket S3-compatível (AWS S3, Cloudflare R2, Google GCS).
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  STORAGE_PUBLIC_BASE_URL: z.string().default('http://localhost:3001/api/v1/files'),
  // Assinatura das URLs de mídia (ADR-0046). Segredo estável entre instâncias em
  // produção; se ausente, cai para um segredo por-processo (dev single-instance).
  MEDIA_URL_SECRET: z.string().optional(),
  MEDIA_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  // Retenção de posições de tracking (dias); 0 desliga o expurgo (ADR-0048).
  TRACKING_RETENTION_DAYS: z.coerce.number().int().min(0).default(90),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // --- Observabilidade (ADR-0021) ---
  // Tracing distribuído é opt-in (precisa de um coletor OTLP). Métricas
  // Prometheus ficam sempre expostas em /metrics (overhead desprezível).
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OTEL_SERVICE_NAME: z.string().default('navix-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  METRICS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // --- Otimização (ADR-0023) ---
  // Reotimização automática ao mudar entregas. Opt-in (default off): quando
  // ligada, o Optimizer reage a eventos do Delivery e reenfileira jobs.
  OPTIMIZER_AUTO_REOPTIMIZE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OPTIMIZER_REOPTIMIZE_DEBOUNCE_MS: z.coerce.number().int().positive().default(2000),
  // Zonas de risco (ADR-0024): JSON de [{latitude,longitude,radiusKm,penalty}].
  // Default vazio → sem efeito (no-op). Parseado/validado em AppConfigService.
  OPTIMIZER_RISK_ZONES: z.string().default('[]'),

  // --- Provedor de mapas/roteamento (ADR-0027) ---
  // `mapbox` usa a Matrix API (requer MAPBOX_TOKEN, já definido acima); qualquer
  // falha cai em Haversine.
  MAPS_PROVIDER: z.enum(['haversine', 'mapbox']).default('haversine'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Exigências que só se aplicam a `NODE_ENV=production` (ADR-0052).
 *
 * Cada item abaixo tem defaults ou fallbacks convenientes em dev que se tornam
 * **perigosos em produção** — e todos falhavam da pior forma possível: em
 * silêncio. Sem `JWT_PRIVATE_KEY` a app gerava um par RSA **por processo**, e
 * com múltiplas instâncias cada uma rejeitava os tokens das outras (login
 * intermitente, todos deslogados a cada deploy); `MEDIA_URL_SECRET` tinha o
 * mesmo defeito nas URLs assinadas de POD. Um `logger.error` não protege
 * ninguém às 3h da manhã: configuração ausente em produção deve **derrubar o
 * boot**, quando o deploy ainda pode ser revertido sem dano.
 *
 * Retorna a lista de problemas (vazia = OK), para ser testável sem processo.
 */
export function assertProductionConfig(env: Env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];

  const requireAll = (keys: (keyof Env)[], why: string): void => {
    const missing = keys.filter((k) => {
      const v = env[k];
      return v === undefined || v === '';
    });
    if (missing.length > 0) problems.push(`${missing.join(', ')}: ${why}`);
  };

  // Chaves de assinatura de JWT — sem elas, par efêmero por instância.
  requireAll(
    ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'JWT_KEY_ID'],
    'obrigatórias em produção (sem elas cada instância assina com um par ' +
      'efêmero próprio e rejeita os tokens das demais).',
  );

  // Segredo de assinatura de URLs de mídia — mesmo defeito, no POD.
  requireAll(
    ['MEDIA_URL_SECRET'],
    'obrigatório em produção (sem ele cada instância assina URLs de POD com um ' +
      'segredo próprio e rejeita os links das demais).',
  );

  // Senha padrão do role de runtime jamais pode chegar a produção.
  if (env.DB_APP_PASSWORD === DEV_APP_PASSWORD) {
    problems.push(
      'DB_APP_PASSWORD: está com a senha padrão de desenvolvimento; defina uma ' +
        'senha própria em produção.',
    );
  }

  // Tráfego de banco sem TLS em produção.
  if (!env.DB_SSL) {
    problems.push('DB_SSL: deve ser "true" em produção (conexão de banco sem TLS).');
  }

  return problems;
}

/** Valida `process.env` e retorna a configuração tipada. Lança em caso de erro. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }

  const problems = assertProductionConfig(parsed.data);
  if (problems.length > 0) {
    throw new Error(
      `Configuração inválida para produção:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return parsed.data;
}
