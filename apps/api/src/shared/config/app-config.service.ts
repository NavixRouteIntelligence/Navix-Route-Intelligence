import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.schema';

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
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      accessTtl: this.get('JWT_ACCESS_TTL'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      refreshTtl: this.get('JWT_REFRESH_TTL'),
    };
  }

  get encryption() {
    return {
      kek: this.get('ENCRYPTION_KEK'),
    };
  }
}
