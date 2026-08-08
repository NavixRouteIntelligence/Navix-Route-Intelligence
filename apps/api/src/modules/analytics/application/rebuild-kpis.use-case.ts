import { Inject, Injectable } from '@nestjs/common';

import {
  DRIVER_KPI_REPOSITORY,
  type DriverKpiRepositoryPort,
} from '../domain/ports/driver-kpi-repository.port';
import { KPI_REPOSITORY, type KpiRepositoryPort } from '../domain/ports/kpi-repository.port';

import { isoDay } from './get-kpi-summary.use-case';

/** Teto do recálculo manual, para uma chamada não varrer anos por engano. */
const MAX_BACKFILL_DAYS = 365;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reconstrói o read model (ADR-0092).
 *
 * Existe em duas formas porque servem a momentos diferentes: `day` mantém o
 * rollup em dia a cada evento, e `backfill` preenche o histórico — de tenants
 * que já operavam antes do read model existir, ou depois de uma correção na
 * projeção.
 */
@Injectable()
export class RebuildKpisUseCase {
  constructor(
    @Inject(KPI_REPOSITORY) private readonly kpis: KpiRepositoryPort,
    @Inject(DRIVER_KPI_REPOSITORY) private readonly driverKpis: DriverKpiRepositoryPort,
  ) {}

  /**
   * Reprojeta o dia nos **dois** read models.
   *
   * O do motorista faltava aqui: só o `backfill` o reconstruía, de modo que uma
   * entrega concluída atualizava o rollup do tenant na hora e a tela do
   * motorista só até seis horas depois, na reconciliação (ADR-0117).
   */
  async day(tenantId: string, at: Date | string = new Date()): Promise<void> {
    const day = typeof at === 'string' ? at : isoDay(at);
    if (!ISO_DAY.test(day)) throw new Error(`Dia de projeção inválido: ${day}`);
    await this.kpis.rebuildDay(tenantId, day);
    await this.driverKpis.rebuildDay(tenantId, day);
  }

  /** Recalcula os últimos `days` dias. Devolve quantos foram reconstruídos. */
  async backfill(tenantId: string, days: number): Promise<number> {
    const total = Math.min(Math.max(days, 1), MAX_BACKFILL_DAYS);
    const hoje = Date.now();
    // Sequencial de propósito: recomputar é I/O de banco, e disparar 365
    // consultas em paralelo competiria com o tráfego real do tenant.
    for (let i = 0; i < total; i++) {
      const dia = isoDay(new Date(hoje - i * 24 * 60 * 60 * 1000));
      await this.kpis.rebuildDay(tenantId, dia);
      await this.driverKpis.rebuildDay(tenantId, dia);
    }
    return total;
  }
}
