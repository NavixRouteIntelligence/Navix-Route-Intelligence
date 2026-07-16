import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ForecastRouteUseCase } from './application/forecast-route.use-case';
import { GetCollectiveInsightUseCase } from './application/get-collective-insight.use-case';
import { InterpretVoiceCommandUseCase } from './application/interpret-voice-command.use-case';
import { PlanLoadUseCase } from './application/plan-load.use-case';
import { RecordObservationUseCase } from './application/record-observation.use-case';
import { ACCESS_INSTRUCTIONS } from './domain/access-instructions.port';
import { COLLECTIVE_INSIGHTS } from './domain/collective-insights.port';
import { DRIVER_PROFILE_SOURCE } from './domain/driver-profile-source.port';
import { LOAD_PLANNER } from './domain/load-planner.port';
import { PARKING_PREDICTOR } from './domain/parking-predictor.port';
import { TRAFFIC_MODEL, TimeContextTrafficModel } from './domain/traffic-model';
import { VOICE_INTERPRETER } from './domain/voice-command-interpreter.port';
import { HeuristicAccessInstructions } from './infrastructure/heuristic-access-instructions';
import { HeuristicLoadPlanner } from './infrastructure/heuristic-load-planner';
import { HeuristicParkingPredictor } from './infrastructure/heuristic-parking-predictor';
import { HeuristicVoiceInterpreter } from './infrastructure/heuristic-voice-interpreter';
import { NoHistoryDriverProfileSource } from './infrastructure/no-history-driver-profile.source';
import { CollectiveObservationOrmEntity } from './infrastructure/persistence/collective-observation.orm-entity';
import { CollectiveInsightsRepository } from './infrastructure/persistence/collective-insights.repository';
import { IntelligenceController } from './interface/intelligence.controller';

/**
 * Navix Intelligence (ADR-0025) — a camada de IA/predição. Serviços de domínio
 * puros (cronograma, atrasos, combustível, saída) + **ports** para trânsito e
 * perfil de motorista, prontos para receber modelos de ML/LLM sem tocar a API.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CollectiveObservationOrmEntity])],
  controllers: [IntelligenceController],
  providers: [
    ForecastRouteUseCase,
    PlanLoadUseCase,
    RecordObservationUseCase,
    GetCollectiveInsightUseCase,
    InterpretVoiceCommandUseCase,
    { provide: TRAFFIC_MODEL, useClass: TimeContextTrafficModel },
    { provide: DRIVER_PROFILE_SOURCE, useClass: NoHistoryDriverProfileSource },
    { provide: ACCESS_INSTRUCTIONS, useClass: HeuristicAccessInstructions },
    { provide: PARKING_PREDICTOR, useClass: HeuristicParkingPredictor },
    { provide: LOAD_PLANNER, useClass: HeuristicLoadPlanner },
    { provide: COLLECTIVE_INSIGHTS, useClass: CollectiveInsightsRepository },
    { provide: VOICE_INTERPRETER, useClass: HeuristicVoiceInterpreter },
  ],
})
export class IntelligenceModule {}
