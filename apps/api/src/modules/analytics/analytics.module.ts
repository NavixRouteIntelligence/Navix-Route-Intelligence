import { Module } from '@nestjs/common';

import { GetDriverDailySnapshotUseCase } from './application/get-driver-daily-snapshot.use-case';
import { GetDriverPerformanceUseCase } from './application/get-driver-performance.use-case';
import { GetKaizenDailyUseCase } from './application/get-kaizen-daily.use-case';
import {
  GetKaizenHistoryUseCase,
  RecordKaizenFeedbackUseCase,
  SetKaizenPreferencesUseCase,
} from './application/kaizen-feedback.use-cases';
import { GetKpiSummaryUseCase } from './application/get-kpi-summary.use-case';
import { KpiProjectionListener } from './application/kpi-projection.listener';
import { RebuildKpisUseCase } from './application/rebuild-kpis.use-case';
import { DRIVER_KPI_REPOSITORY } from './domain/ports/driver-kpi-repository.port';
import { KAIZEN_ADVISOR } from './domain/ports/kaizen-advisor.port';
import { KAIZEN_FEEDBACK_REPOSITORY } from './domain/ports/kaizen-feedback-repository.port';
import { KPI_REPOSITORY } from './domain/ports/kpi-repository.port';
import { RuleBasedKaizenAdvisor } from './infrastructure/advisor/rule-based-kaizen.advisor';
import { DriverKpiRepository } from './infrastructure/persistence/driver-kpi.repository';
import { KaizenFeedbackRepository } from './infrastructure/persistence/kaizen-feedback.repository';
import { KpiRepository } from './infrastructure/persistence/kpi.repository';
import { DriverPerformanceController } from './interface/driver-performance.controller';
import { KaizenController } from './interface/kaizen.controller';
import { KpiController } from './interface/kpi.controller';

/**
 * Read models de leitura (ADR-0092) — o lado **query** do CQRS leve previsto na
 * ADR-0011, que até aqui existia só no papel.
 *
 * Não importa módulo de negócio nenhum: a projeção lê as tabelas de origem por
 * SQL, sob a RLS do tenant. É a assimetria que define CQRS — o lado de escrita
 * mantém suas fronteiras e seus agregados; o de leitura otimiza para a
 * pergunta que a tela faz, e paga por isso com a duplicação controlada do dado.
 */
@Module({
  controllers: [KpiController, DriverPerformanceController, KaizenController],
  providers: [
    GetKpiSummaryUseCase,
    GetDriverPerformanceUseCase,
    GetDriverDailySnapshotUseCase,
    GetKaizenDailyUseCase,
    RecordKaizenFeedbackUseCase,
    GetKaizenHistoryUseCase,
    SetKaizenPreferencesUseCase,
    RebuildKpisUseCase,
    KpiProjectionListener,
    { provide: KPI_REPOSITORY, useClass: KpiRepository },
    { provide: DRIVER_KPI_REPOSITORY, useClass: DriverKpiRepository },
    { provide: KAIZEN_ADVISOR, useClass: RuleBasedKaizenAdvisor },
    { provide: KAIZEN_FEEDBACK_REPOSITORY, useClass: KaizenFeedbackRepository },
  ],
})
export class AnalyticsModule {}
