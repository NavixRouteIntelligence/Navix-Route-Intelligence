import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FleetModule } from '../fleet/fleet.module';
import { OptimizerModule } from '../optimizer/optimizer.module';
import { TrackingModule } from '../tracking/tracking.module';
import { ChangeDeliveryStatusUseCase } from './application/change-delivery-status.use-case';
import { CreateDeliveryUseCase } from './application/create-delivery.use-case';
import { DeleteDeliveryUseCase } from './application/delete-delivery.use-case';
import { GetDeliveryInsightsUseCase } from './application/get-delivery-insights.use-case';
import { GetDeliveryUseCase } from './application/get-delivery.use-case';
import { GetPublicTrackingUseCase } from './application/get-public-tracking.use-case';
import { IssueTrackingLinkUseCase } from './application/issue-tracking-link.use-case';
import { ListDeliveriesUseCase } from './application/list-deliveries.use-case';
import { SyncDeliveriesUseCase } from './application/sync-deliveries.use-case';
import { UpdateDeliveryUseCase } from './application/update-delivery.use-case';
import { DELIVERY_LOOKUP, DeliveryLookupService } from './application/delivery-lookup.service';
import { DELIVERY_WRITER, DeliveryWriterService } from './application/delivery-writer.service';
import { FLEET_GATEWAY } from './application/ports/fleet-gateway.port';
import {
  ROUTE_ETA_GATEWAY,
  VEHICLE_LOCATION_GATEWAY,
} from './application/ports/public-tracking-sources.port';
import { DELIVERY_REPOSITORY } from './domain/ports/delivery-repository.port';
import { TRACKING_TOKEN_REPOSITORY } from './domain/ports/tracking-token-repository.port';
import { FleetGateway } from './infrastructure/gateways/fleet.gateway';
import {
  RouteEtaGateway,
  VehicleLocationGateway,
} from './infrastructure/gateways/public-tracking.gateways';
import { DeliveryOrmEntity } from './infrastructure/persistence/delivery.orm-entity';
import { DeliveryRepository } from './infrastructure/persistence/delivery.repository';
import { DeliveryTrackingTokenOrmEntity } from './infrastructure/persistence/delivery-tracking-token.orm-entity';
import { TrackingTokenRepository } from './infrastructure/persistence/tracking-token.repository';
import { DeliveryController } from './interface/delivery.controller';
import { PublicTrackingController } from './interface/public-tracking.controller';

/**
 * Módulo Delivery. Importa o FleetModule para consumir sua API pública
 * (FleetLookup) através da porta anti-corrupção FLEET_GATEWAY.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryOrmEntity, DeliveryTrackingTokenOrmEntity]),
    FleetModule,
    // Rastreamento público (ADR-0082): ETA vem do Optimizer, posição do
    // Tracking — sempre via gateways anti-corrupção, nunca por repositório.
    OptimizerModule,
    TrackingModule,
  ],
  controllers: [DeliveryController, PublicTrackingController],
  providers: [
    CreateDeliveryUseCase,
    GetDeliveryUseCase,
    GetDeliveryInsightsUseCase,
    ListDeliveriesUseCase,
    SyncDeliveriesUseCase,
    UpdateDeliveryUseCase,
    ChangeDeliveryStatusUseCase,
    DeleteDeliveryUseCase,
    IssueTrackingLinkUseCase,
    GetPublicTrackingUseCase,
    { provide: DELIVERY_REPOSITORY, useClass: DeliveryRepository },
    { provide: TRACKING_TOKEN_REPOSITORY, useClass: TrackingTokenRepository },
    { provide: FLEET_GATEWAY, useClass: FleetGateway },
    { provide: ROUTE_ETA_GATEWAY, useClass: RouteEtaGateway },
    { provide: VEHICLE_LOCATION_GATEWAY, useClass: VehicleLocationGateway },
    { provide: DELIVERY_LOOKUP, useClass: DeliveryLookupService },
    { provide: DELIVERY_WRITER, useClass: DeliveryWriterService },
  ],
  exports: [DELIVERY_LOOKUP, DELIVERY_WRITER],
})
export class DeliveryModule {}
