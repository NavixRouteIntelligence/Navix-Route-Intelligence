import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FleetModule } from '../fleet/fleet.module';
import { ChangeDeliveryStatusUseCase } from './application/change-delivery-status.use-case';
import { CreateDeliveryUseCase } from './application/create-delivery.use-case';
import { DeleteDeliveryUseCase } from './application/delete-delivery.use-case';
import { GetDeliveryUseCase } from './application/get-delivery.use-case';
import { ListDeliveriesUseCase } from './application/list-deliveries.use-case';
import { UpdateDeliveryUseCase } from './application/update-delivery.use-case';
import { DELIVERY_LOOKUP, DeliveryLookupService } from './application/delivery-lookup.service';
import { FLEET_GATEWAY } from './application/ports/fleet-gateway.port';
import { DELIVERY_REPOSITORY } from './domain/ports/delivery-repository.port';
import { FleetGateway } from './infrastructure/gateways/fleet.gateway';
import { DeliveryOrmEntity } from './infrastructure/persistence/delivery.orm-entity';
import { DeliveryRepository } from './infrastructure/persistence/delivery.repository';
import { DeliveryController } from './interface/delivery.controller';

/**
 * Módulo Delivery. Importa o FleetModule para consumir sua API pública
 * (FleetLookup) através da porta anti-corrupção FLEET_GATEWAY.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DeliveryOrmEntity]), FleetModule],
  controllers: [DeliveryController],
  providers: [
    CreateDeliveryUseCase,
    GetDeliveryUseCase,
    ListDeliveriesUseCase,
    UpdateDeliveryUseCase,
    ChangeDeliveryStatusUseCase,
    DeleteDeliveryUseCase,
    { provide: DELIVERY_REPOSITORY, useClass: DeliveryRepository },
    { provide: FLEET_GATEWAY, useClass: FleetGateway },
    { provide: DELIVERY_LOOKUP, useClass: DeliveryLookupService },
  ],
  exports: [DELIVERY_LOOKUP],
})
export class DeliveryModule {}
