import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { QueryPodUseCase } from './application/query-pod.use-case';
import { SubmitPodUseCase } from './application/submit-pod.use-case';
import { DELIVERY_OUTCOME, POD_REPOSITORY } from './domain/ports/pod-repository.port';
import { DeliveryOutcomeGateway } from './infrastructure/gateways/delivery-outcome.gateway';
import { PodOrmEntity } from './infrastructure/persistence/pod.orm-entity';
import { PodRepository } from './infrastructure/persistence/pod.repository';
import { PodController } from './interface/pod.controller';

/**
 * Proof of Delivery. Registra comprovantes (foto/assinatura/GPS) e aplica o
 * desfecho na entrega via a API pública do Delivery (porta anti-corrupção).
 */
@Module({
  imports: [TypeOrmModule.forFeature([PodOrmEntity]), DeliveryModule],
  controllers: [PodController],
  providers: [
    SubmitPodUseCase,
    QueryPodUseCase,
    { provide: POD_REPOSITORY, useClass: PodRepository },
    { provide: DELIVERY_OUTCOME, useClass: DeliveryOutcomeGateway },
  ],
})
export class PodModule {}
