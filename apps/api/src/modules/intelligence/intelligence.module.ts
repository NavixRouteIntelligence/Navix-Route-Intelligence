import { Module } from '@nestjs/common';

import { ForecastRouteUseCase } from './application/forecast-route.use-case';
import { DRIVER_PROFILE_SOURCE } from './domain/driver-profile-source.port';
import { TRAFFIC_MODEL, TimeContextTrafficModel } from './domain/traffic-model';
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
  ],
})
export class IntelligenceModule {}
