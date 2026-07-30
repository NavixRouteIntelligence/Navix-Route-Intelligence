import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ForecastRouteUseCase } from './application/forecast-route.use-case';
import {
  COLLECTIVE_SERVICE_TIMES,
  CollectiveServiceTimeLookup,
} from './application/collective-service-time.lookup';
import { GetCollectiveInsightUseCase } from './application/get-collective-insight.use-case';
import { InterpretVoiceCommandUseCase } from './application/interpret-voice-command.use-case';
import { PlanLoadUseCase } from './application/plan-load.use-case';
import { RecordDerivedServiceTimeUseCase } from './application/record-derived-service-time.use-case';
import { RefreshCellFeaturesUseCase } from './application/refresh-cell-features.use-case';
import { ETA_CORRECTION, EtaCorrectionService } from './application/eta-correction.service';
import { StoreEtaModelUseCase } from './application/store-eta-model.use-case';
import { ETA_CORRECTION_REPOSITORY } from './domain/ports/eta-correction-repository.port';
import { EtaCorrectionOrmEntity } from './infrastructure/persistence/eta-correction.orm-entity';
import { EtaCorrectionRepository } from './infrastructure/persistence/eta-correction.repository';
import { RecordObservationUseCase } from './application/record-observation.use-case';
import { ACCESS_INSTRUCTIONS } from './domain/access-instructions.port';
import { COLLECTIVE_INSIGHTS } from './domain/collective-insights.port';
import { DRIVER_PROFILE_SOURCE } from './domain/driver-profile-source.port';
import { LOAD_PLANNER } from './domain/load-planner.port';
import { PARKING_PREDICTOR } from './domain/parking-predictor.port';
import { TRAFFIC_MODEL, TimeContextTrafficModel } from './domain/traffic-model';
import { VOICE_INTERPRETER } from './domain/voice-command-interpreter.port';
import { CommunityAwareParkingPredictor } from './infrastructure/community-aware-parking-predictor';
import { HeuristicAccessInstructions } from './infrastructure/heuristic-access-instructions';
import { HeuristicLoadPlanner } from './infrastructure/heuristic-load-planner';
import { HeuristicVoiceInterpreter } from './infrastructure/heuristic-voice-interpreter';
import { NoHistoryDriverProfileSource } from './infrastructure/no-history-driver-profile.source';
import { CellFeatureOrmEntity } from './infrastructure/persistence/cell-feature.orm-entity';
import { CellFeatureRepository } from './infrastructure/persistence/cell-feature.repository';
import { CELL_FEATURE_REPOSITORY } from './domain/ports/cell-feature-repository.port';
import { CollectiveObservationOrmEntity } from './infrastructure/persistence/collective-observation.orm-entity';
import { CollectiveInsightsRepository } from './infrastructure/persistence/collective-insights.repository';
import { IntelligenceController } from './interface/intelligence.controller';

/**
 * Navix Intelligence (ADR-0025) — a camada de IA/predição. Serviços de domínio
 * puros (cronograma, atrasos, combustível, saída) + **ports** para trânsito e
 * perfil de motorista, prontos para receber modelos de ML/LLM sem tocar a API.
 */
@Module({
  imports: [TypeOrmModule.forFeature([
      CollectiveObservationOrmEntity,
      CellFeatureOrmEntity,
      EtaCorrectionOrmEntity,
    ])],
  controllers: [IntelligenceController],
  providers: [
    ForecastRouteUseCase,
    PlanLoadUseCase,
    RecordObservationUseCase,
    RecordDerivedServiceTimeUseCase,
    RefreshCellFeaturesUseCase,
    EtaCorrectionService,
    StoreEtaModelUseCase,
    GetCollectiveInsightUseCase,
    InterpretVoiceCommandUseCase,
    { provide: TRAFFIC_MODEL, useClass: TimeContextTrafficModel },
    { provide: DRIVER_PROFILE_SOURCE, useClass: NoHistoryDriverProfileSource },
    { provide: ACCESS_INSTRUCTIONS, useClass: HeuristicAccessInstructions },
    { provide: PARKING_PREDICTOR, useClass: CommunityAwareParkingPredictor },
    { provide: LOAD_PLANNER, useClass: HeuristicLoadPlanner },
    { provide: COLLECTIVE_INSIGHTS, useClass: CollectiveInsightsRepository },
    { provide: VOICE_INTERPRETER, useClass: HeuristicVoiceInterpreter },
    { provide: COLLECTIVE_SERVICE_TIMES, useClass: CollectiveServiceTimeLookup },
    { provide: CELL_FEATURE_REPOSITORY, useClass: CellFeatureRepository },
    { provide: ETA_CORRECTION_REPOSITORY, useClass: EtaCorrectionRepository },
    { provide: ETA_CORRECTION, useExisting: EtaCorrectionService },
  ],
  // Exposto para o Optimizer usar o tempo de serviço típico no custo (RSE-4).
  // O modelo de ETA sai por `ETA_CORRECTION` (quem prevê) e por
  // `StoreEtaModelUseCase` (quem treina) — ADR-0090.
  exports: [
    COLLECTIVE_SERVICE_TIMES,
    RecordDerivedServiceTimeUseCase,
    ETA_CORRECTION,
    StoreEtaModelUseCase,
  ],
})
export class IntelligenceModule {}
