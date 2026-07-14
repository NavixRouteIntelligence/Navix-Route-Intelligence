import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.schema';

/** Converte "\n" literais (comuns em env) em quebras de linha reais do PEM. */
function normalizePem(value: string | undefined): string | undefined {
  return value ? value.replace(/\\n/g, '\n') : undefined;
}

/**
 * Acesso tipado à configuração. Encapsula o ConfigService do Nest para que o
 * resto da aplicação não dependa de strings de chave nem de `process.env`.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get api() {
    return {
      port: this.get('API_PORT'),
      globalPrefix: this.get('API_GLOBAL_PREFIX'),
      corsOrigins: this.get('CORS_ORIGINS')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    };
  }

  get database() {
    return {
      host: this.get('DB_HOST'),
      port: this.get('DB_PORT'),
      directPort: this.get('DB_DIRECT_PORT'),
      user: this.get('DB_USER'),
      password: this.get('DB_PASSWORD'),
      // Runtime da aplicação (não-owner, sujeito à RLS).
      appUser: this.get('DB_APP_USER'),
      appPassword: this.get('DB_APP_PASSWORD'),
      name: this.get('DB_NAME'),
      ssl: this.get('DB_SSL'),
    };
  }

  get redis() {
    return {
      host: this.get('REDIS_HOST'),
      port: this.get('REDIS_PORT'),
      password: this.get('REDIS_PASSWORD') || undefined,
    };
  }

  get jwt() {
    return {
      accessTtl: this.get('JWT_ACCESS_TTL'),
      refreshTtl: this.get('JWT_REFRESH_TTL'),
      // Chaves RS256. Newlines em env costumam vir escapados como "\n".
      privateKey: normalizePem(this.get('JWT_PRIVATE_KEY')),
      publicKey: normalizePem(this.get('JWT_PUBLIC_KEY')),
      keyId: this.get('JWT_KEY_ID'),
      previousPublicKey: normalizePem(this.get('JWT_PREVIOUS_PUBLIC_KEY')),
      previousKeyId: this.get('JWT_PREVIOUS_KEY_ID'),
    };
  }

  get encryption() {
    return {
      kek: this.get('ENCRYPTION_KEK'),
    };
  }

  get mapboxToken(): string | undefined {
    return this.get('MAPBOX_TOKEN');
  }

  get storage() {
    return {
      driver: this.get('STORAGE_DRIVER'),
      localDir: this.get('STORAGE_LOCAL_DIR'),
      publicBaseUrl: this.get('STORAGE_PUBLIC_BASE_URL'),
      s3: {
        endpoint: this.get('S3_ENDPOINT'),
        region: this.get('S3_REGION'),
        bucket: this.get('S3_BUCKET'),
        accessKeyId: this.get('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.get('S3_SECRET_ACCESS_KEY'),
        publicBaseUrl: this.get('S3_PUBLIC_BASE_URL'),
        forcePathStyle: this.get('S3_FORCE_PATH_STYLE'),
      },
    };
  }

  get observability() {
    return {
      tracingEnabled: this.get('OTEL_ENABLED'),
      serviceName: this.get('OTEL_SERVICE_NAME'),
      otlpEndpoint: this.get('OTEL_EXPORTER_OTLP_ENDPOINT'),
      metricsEnabled: this.get('METRICS_ENABLED'),
    };
  }
}
