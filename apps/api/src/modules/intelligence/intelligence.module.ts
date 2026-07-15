import { Module } from '@nestjs/common';

import { ForecastRouteUseCase } from './application/forecast-route.use-case';
import { ACCESS_INSTRUCTIONS } from './domain/access-instructions.port';
import { DRIVER_PROFILE_SOURCE } from './domain/driver-profile-source.port';
import { TRAFFIC_MODEL, TimeContextTrafficModel } from './domain/traffic-model';
import { HeuristicAccessInstructions } from './infrastructure/heuristic-access-instructions';
import { NoHistoryDriverProfileSource } from './infrastructure/no-history-driver-profile.source';
import { IntelligenceController } from './interface/intelligence.controller';

/**
 * Navix Intelligence (ADR-0025) — a camada de IA/predição. Serviços de domínio
 * puros (cronograma, atrasos, combustível, saída) + **ports** para trânsito e
 * perfil de motorista, prontos para receber modelos de ML/LLM sem tocar a API.
 */
@Module({
  controllers: [IntelligenceController],
  providers: [
    ForecastRouteUseCase,
    { provide: TRAFFIC_MODEL, useClass: TimeContextTrafficModel },
    { provide: DRIVER_PROFILE_SOURCE, useClass: NoHistoryDriverProfileSource },
    { provide: ACCESS_INSTRUCTIONS, useClass: HeuristicAccessInstructions },
  ],
})
export class IntelligenceModule {}
