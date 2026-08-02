import { Module } from '@nestjs/common';

import { GetDriverPerformanceUseCase } from './application/get-driver-performance.use-case';
import { GetKpiSummaryUseCase } from './application/get-kpi-summary.use-case';
import { KpiProjectionListener } from './application/kpi-projection.listener';
import { RebuildKpisUseCase } from './application/rebuild-kpis.use-case';
import { DRIVER_KPI_REPOSITORY } from './domain/ports/driver-kpi-repository.port';
import { KPI_REPOSITORY } from './domain/ports/kpi-repository.port';
import { DriverKpiRepository } from './infrastructure/persistence/driver-kpi.repository';
import { KpiRepository } from './infrastructure/persistence/kpi.repository';
import { DriverPerformanceController } from './interface/driver-performance.controller';
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
  controllers: [KpiController, DriverPerformanceController],
  providers: [
    GetKpiSummaryUseCase,
    GetDriverPerformanceUseCase,
    RebuildKpisUseCase,
    KpiProjectionListener,
    { provide: KPI_REPOSITORY, useClass: KpiRepository },
    { provide: DRIVER_KPI_REPOSITORY, useClass: DriverKpiRepository },
  ],
})
export class AnalyticsModule {}
