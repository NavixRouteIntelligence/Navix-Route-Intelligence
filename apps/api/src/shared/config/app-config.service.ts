import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.schema';

/** Converte "\n" literais (comuns em env) em quebras de linha reais do PEM. */
function normalizePem(value: string | undefined): string | undefined {
  return value ? value.replace(/\\n/g, '\n') : undefined;
}

/** Pórtico de portagem declarado pelo operador (ADR-0111). */
export interface TollGate {
  latitude: number;
  longitude: number;
  radiusKm: number;
  cost: number;
}

export interface RiskZoneConfig {
  latitude: number;
  longitude: number;
  radiusKm: number;
  penalty: number;
}

/** Parseia com segurança o JSON de zonas de risco (ADR-0024); inválido → []. */
/** Pórticos de portagem (ADR-0111). JSON inválido degrada para lista vazia. */
function parseTollGates(raw: string): TollGate[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((g): g is TollGate => {
      if (!g || typeof g !== 'object') return false;
      const r = g as Record<string, unknown>;
      return (
        typeof r.latitude === 'number' &&
        typeof r.longitude === 'number' &&
        typeof r.radiusKm === 'number' &&
        typeof r.cost === 'number' &&
        r.cost > 0
      );
    });
  } catch {
    return [];
  }
}

/** Override dos pesos por objetivo (ADR-0111). JSON inválido é ignorado. */
function parseWeightOverrides(raw: string): Record<string, Record<string, number>> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, Record<string, number>>;
  } catch {
    return {};
  }
}

function parseRiskZones(raw: string): RiskZoneConfig[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((z): z is RiskZoneConfig => {
      if (!z || typeof z !== 'object') return false;
      const r = z as Record<string, unknown>;
      return (
        typeof r.latitude === 'number' &&
        typeof r.longitude === 'number' &&
        typeof r.radiusKm === 'number' &&
        typeof r.penalty === 'number'
      );
    });
  } catch {
    return [];
  }
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
      db: this.get('REDIS_DB'),
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
      mediaUrlSecret: this.get('MEDIA_URL_SECRET'),
      mediaUrlTtlSeconds: this.get('MEDIA_URL_TTL_SECONDS'),
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

  /** Rastreamento público da entrega pelo destinatário (ADR-0082). */
  get publicTracking() {
    return {
      // Sem barra final: o use case concatena `/<token>`.
      baseUrl: this.get('PUBLIC_TRACKING_BASE_URL').replace(/\/+$/, ''),
    };
  }

  /** Convite de motorista (ADR-0085). */
  get driverInvites() {
    return {
      // Sem barra final: o use case concatena `/<token>`.
      baseUrl: this.get('DRIVER_INVITE_BASE_URL').replace(/\/+$/, ''),
      ttlHours: this.get('DRIVER_INVITE_TTL_HOURS'),
    };
  }

  /** Resolução pública de tenant por subdomínio/domínio verificado (ADR-0096). */
  get enterprise() {
    return {
      tenantBaseDomain: this.get('TENANT_BASE_DOMAIN').trim().toLowerCase(),
    };
  }

  /** Alertas preditivos de estouro de janela (ADR-0091). */
  get delayRiskAlerts() {
    return {
      enabled: this.get('DELAY_RISK_ALERTS_ENABLED'),
      checkIntervalMs: this.get('DELAY_RISK_CHECK_INTERVAL_MS'),
    };
  }

  get tracking() {
    return {
      retentionDays: this.get('TRACKING_RETENTION_DAYS'),
      geofenceAutomationEnabled: this.get('TRACKING_GEOFENCE_AUTOMATION_ENABLED'),
      geofenceDwellMinutes: this.get('TRACKING_GEOFENCE_DWELL_MINUTES'),
      geofenceCheckIntervalMs: this.get('TRACKING_GEOFENCE_CHECK_INTERVAL_MS'),
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

  get optimizer() {
    return {
      autoReoptimize: this.get('OPTIMIZER_AUTO_REOPTIMIZE'),
      reoptimizeDebounceMs: this.get('OPTIMIZER_REOPTIMIZE_DEBOUNCE_MS'),
      riskZones: parseRiskZones(this.get('OPTIMIZER_RISK_ZONES')),
      tollGates: parseTollGates(this.get('OPTIMIZER_TOLL_GATES')),
      weightOverrides: parseWeightOverrides(this.get('OPTIMIZER_WEIGHTS')),
      queueDriver: this.get('OPTIMIZER_QUEUE_DRIVER'),
      workerEnabled: this.get('OPTIMIZER_WORKER_ENABLED'),
      delayCheckIntervalMs: this.get('OPTIMIZER_DELAY_CHECK_INTERVAL_MS'),
      delayThresholdMinutes: this.get('OPTIMIZER_DELAY_THRESHOLD_MINUTES'),
      jobAttempts: this.get('OPTIMIZER_JOB_ATTEMPTS'),
      jobBackoffMs: this.get('OPTIMIZER_JOB_BACKOFF_MS'),
    };
  }

  /** Notificações ao destinatário (ADR-0084). */
  get notifications() {
    return {
      enabled: this.get('NOTIFICATIONS_ENABLED'),
      channel: this.get('NOTIFICATIONS_CHANNEL'),
      locale: this.get('NOTIFICATIONS_LOCALE'),
      proximityRadiusKm: this.get('NOTIFICATIONS_PROXIMITY_RADIUS_KM'),
      proximityCheckIntervalMs: this.get('NOTIFICATIONS_PROXIMITY_INTERVAL_MS'),
    };
  }

  get maps() {
    return {
      provider: this.get('MAPS_PROVIDER'),
      mapboxToken: this.get('MAPBOX_TOKEN') || undefined,
      /**
       * Recusar rota em vez de entregar geometria (ADR-0107). Desligado por
       * padrão: ligá-lo troca disponibilidade por exatidão, e essa é uma
       * decisão de quem opera — não um default que a gente escolhe por ele.
       */
      requireProvider: this.get('MAPS_REQUIRE_PROVIDER') === 'true',
    };
  }
}
