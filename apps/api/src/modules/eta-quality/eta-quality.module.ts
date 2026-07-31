import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { OptimizerModule } from '../optimizer/optimizer.module';
import { TrackingModule } from '../tracking/tracking.module';
import { EtaQualityListener } from './application/eta-quality.listener';
import { GetEtaQualityUseCase } from './application/get-eta-quality.use-case';
import { DelayRiskAlertListener } from './application/delay-risk-alert.listener';
import { PredictBreachRiskUseCase } from './application/predict-breach-risk.use-case';
import { RecordEtaObservationUseCase } from './application/record-eta-observation.use-case';
import { TrainEtaModelUseCase } from './application/train-eta-model.use-case';
import { ETA_OBSERVATION_REPOSITORY } from './domain/ports/eta-observation-repository.port';
import { EtaMetrics } from './infrastructure/observability/eta-metrics';
import { EtaObservationOrmEntity } from './infrastructure/persistence/eta-observation.orm-entity';
import { EtaObservationRepository } from './infrastructure/persistence/eta-observation.repository';
import { EtaQualityController } from './interface/eta-quality.controller';

/**
 * Medição do erro de ETA (ADR-0087) — a régua do modelo real da Fase 3.
 *
 * ## Por que é um módulo próprio
 *
 * A medição **compõe** a previsão (Optimizer) com o desfecho (Delivery). Não
 * cabe em nenhum dos dois: o Optimizer já importa o Delivery (ADR-0064 fixa
 * essa direção) e o Delivery não deve conhecer o Optimizer. Como módulo à
 * parte, a dependência só aponta para baixo (`eta-quality → {delivery,
 * optimizer}`) e ambos são consumidos pelas suas APIs públicas
 * (`DELIVERY_LOOKUP`, `OPTIMIZER_SERVICE`). Mesmo desenho do `public-tracking`
 * (ADR-0082) e do `driver-invite` (ADR-0085).
 *
 * Não exporta nada: por enquanto ninguém consome a medição de dentro do
 * backend — ela sai por `/metrics` e pelo endpoint de resumo. Quando o modelo
 * treinável chegar, é daqui que ele lê o corpus.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EtaObservationOrmEntity]),
    DeliveryModule,
    OptimizerModule,
    // Rastro de GPS (medida do atendimento) e corpus coletivo (onde ela é
    // gravada) — ADR-0088. Ambos pelas suas APIs públicas.
    TrackingModule,
    IntelligenceModule,
    // Canal ao destinatário (ADR-0084), reusado pelos alertas preditivos.
    NotificationsModule,
  ],
  controllers: [EtaQualityController],
  providers: [
    RecordEtaObservationUseCase,
    GetEtaQualityUseCase,
    TrainEtaModelUseCase,
    PredictBreachRiskUseCase,
    DelayRiskAlertListener,
    EtaQualityListener,
    EtaMetrics,
    { provide: ETA_OBSERVATION_REPOSITORY, useClass: EtaObservationRepository },
  ],
})
export class EtaQualityModule {}
