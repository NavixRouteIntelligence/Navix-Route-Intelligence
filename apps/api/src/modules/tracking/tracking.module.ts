import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { FleetModule } from '../fleet/fleet.module';

import { BatchUpdatePositionsUseCase } from './application/batch-update-positions.use-case';
import { GeofenceStatusAutomationService } from './application/geofence-status-automation.service';
import { DRIVER_ACCOUNT_LINK } from './application/ports/driver-account-link.port';
import { GEOFENCE_STATUS_AUTOMATION } from './application/ports/geofence-status-automation.port';
import { QueryPositionsUseCase } from './application/query-positions.use-case';
import { UpdatePositionUseCase } from './application/update-position.use-case';
import { POSITION_REPOSITORY } from './domain/ports/position-repository.port';
import { TRACKING_EVENTS } from './domain/ports/tracking-events.port';
import { RealtimeTrackingEvents } from './infrastructure/events/realtime-tracking-events';
import { DriverAccountLinkGateway } from './infrastructure/gateways/driver-account-link.gateway';
import { DriverPositionOrmEntity } from './infrastructure/persistence/driver-position.orm-entity';
import { PositionRepository } from './infrastructure/persistence/position.repository';
import { TrackingController } from './interface/tracking.controller';

/**
 * Módulo Tracking (MVP). Ingestão e consulta de posições de motoristas, com
 * isolamento por tenant (RLS) e RBAC. Preparado para evoluir com ETA, otimização
 * dinâmica e notificações, e para transporte em tempo real (WebSocket/SSE).
 */
@Module({
  // FleetModule entra para traduzir ficha↔login (ADR-0086), sempre pela API
  // pública `FLEET_LOOKUP`. A direção só aponta para baixo — o Fleet não
  // conhece o Tracking —, então não há ciclo.
  imports: [TypeOrmModule.forFeature([DriverPositionOrmEntity]), FleetModule, DeliveryModule],
  controllers: [TrackingController],
  providers: [
    UpdatePositionUseCase,
    BatchUpdatePositionsUseCase,
    QueryPositionsUseCase,
    {
      provide: GEOFENCE_STATUS_AUTOMATION,
      useClass: GeofenceStatusAutomationService,
    },
    { provide: POSITION_REPOSITORY, useClass: PositionRepository },
    { provide: TRACKING_EVENTS, useClass: RealtimeTrackingEvents },
    { provide: DRIVER_ACCOUNT_LINK, useClass: DriverAccountLinkGateway },
  ],
  // API pública do módulo: o Delivery consome a última posição do motorista
  // para o rastreamento público da entrega (ADR-0082), via gateway
  // anti-corrupção — nunca tocando no repositório de posições diretamente.
  exports: [QueryPositionsUseCase],
})
export class TrackingModule {}
