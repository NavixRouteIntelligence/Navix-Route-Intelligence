import { Module } from '@nestjs/common';

import { AppConfigModule } from './shared/config/config.module';
import { AuditModule } from './shared/audit/audit.module';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './shared/observability/logger.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { OptimizerModule } from './modules/optimizer/optimizer.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';

/**
 * Módulo raiz. Compõe infraestrutura transversal (config, logging, banco) e
 * os módulos de funcionalidade. Fase 1: adiciona Fleet (veículos e motoristas).
 * Próximos módulos de negócio (Delivery, Routing) entram nas fases seguintes.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    DatabaseModule,
    AuditModule,
    HealthModule,
    IdentityModule,
    FleetModule,
    DeliveryModule,
    OptimizerModule,
  ],
})
export class AppModule {}
