import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { OptimizerModule } from '../optimizer/optimizer.module';
import { TrackingModule } from '../tracking/tracking.module';
import { GetPublicTrackingUseCase } from './application/get-public-tracking.use-case';
import { IssueTrackingLinkUseCase } from './application/issue-tracking-link.use-case';
import { ResolveTrackingTokenUseCase } from './application/resolve-tracking-token.use-case';
import {
  ROUTE_ETA_GATEWAY,
  VEHICLE_LOCATION_GATEWAY,
} from './application/ports/public-tracking-sources.port';
import { TRACKING_TOKEN_REPOSITORY } from './domain/ports/tracking-token-repository.port';
import {
  RouteEtaGateway,
  VehicleLocationGateway,
} from './infrastructure/gateways/public-tracking.gateways';
import { DeliveryTrackingTokenOrmEntity } from './infrastructure/persistence/delivery-tracking-token.orm-entity';
import { TrackingTokenRepository } from './infrastructure/persistence/tracking-token.repository';
import { PublicTrackingController } from './interface/public-tracking.controller';
import { TrackingLinkController } from './interface/tracking-link.controller';

/**
 * Rastreamento público da entrega (ADR-0082).
 *
 * ## Por que é um módulo próprio
 *
 * A feature **compõe** três contextos: a entrega (status, destino), o plano de
 * rota (ETA) e o tracking (posição). Colocá-la dentro do Delivery faria o
 * Delivery importar o Optimizer — mas o **Optimizer já importa o Delivery**
 * (ADR-0064 fixa essa direção), e o ciclo impedia o Nest de subir a aplicação.
 *
 * Como módulo à parte, a dependência só aponta para baixo
 * (`public-tracking → {delivery, optimizer, tracking}`) e a direção original
 * fica preservada. Os três são consumidos pelas suas **APIs públicas**
 * (`DELIVERY_LOOKUP`, `OPTIMIZER_SERVICE`, `QueryPositionsUseCase`), nunca
 * pelos repositórios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryTrackingTokenOrmEntity]),
    DeliveryModule,
    OptimizerModule,
    TrackingModule,
  ],
  controllers: [PublicTrackingController, TrackingLinkController],
  providers: [
    GetPublicTrackingUseCase,
    IssueTrackingLinkUseCase,
    ResolveTrackingTokenUseCase,
    { provide: TRACKING_TOKEN_REPOSITORY, useClass: TrackingTokenRepository },
    { provide: ROUTE_ETA_GATEWAY, useClass: RouteEtaGateway },
    { provide: VEHICLE_LOCATION_GATEWAY, useClass: VehicleLocationGateway },
  ],
  // API pública do módulo: emitir o link e resolver o token. O repositório de
  // tokens fica interno — quem precisa interpretar um token usa estes casos de
  // uso, não a persistência (ADR-0084).
  exports: [IssueTrackingLinkUseCase, ResolveTrackingTokenUseCase],
})
export class PublicTrackingModule {}
