import { Module } from '@nestjs/common';

import { AppConfigModule } from './shared/config/config.module';
import { AuditModule } from './shared/audit/audit.module';
import { CacheModule } from './shared/cache/cache.module';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './shared/observability/logger.module';
import { QueueModule } from './shared/queue/queue.module';
import { RealtimeModule } from './shared/realtime/realtime.module';
import { RedisModule } from './shared/redis/redis.module';
import { StorageModule } from './shared/storage/storage.module';
import { TenancyModule } from './shared/tenancy/tenancy.module';
import { IdempotencyModule } from './shared/idempotency/idempotency.module';
import { ThrottlingModule } from './shared/security/throttling.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { ImportModule } from './modules/import/import.module';
import { OptimizerModule } from './modules/optimizer/optimizer.module';
import { PodModule } from './modules/pod/pod.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { UserSettingsModule } from './modules/user-settings/user-settings.module';

/**
 * Módulo raiz. Compõe infraestrutura transversal (config, logging, banco) e
 * os módulos de funcionalidade. Fase 1: adiciona Fleet (veículos e motoristas).
 * Próximos módulos de negócio (Delivery, Routing) entram nas fases seguintes.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    RedisModule,
    RealtimeModule,
    StorageModule,
    CacheModule,
    QueueModule,
    DatabaseModule,
    AuditModule,
    TenancyModule,
    // Depois de Tenancy: o interceptor de idempotência roda dentro da tx de tenant.
    IdempotencyModule,
    ThrottlingModule,
    HealthModule,
    IdentityModule,
    UserSettingsModule,
    FleetModule,
    DeliveryModule,
    OptimizerModule,
    ImportModule,
    TrackingModule,
    PodModule,
  ],
})
export class AppModule {}
