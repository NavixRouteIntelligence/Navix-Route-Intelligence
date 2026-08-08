import { Inject, Injectable } from '@nestjs/common';

import {
  summarizeDriverPerformance,
  type DriverDayRow,
  type DriverPerformance,
} from '../domain/driver-performance';
import {
  DRIVER_KPI_REPOSITORY,
  type DriverKpiRepositoryPort,
} from '../domain/ports/driver-kpi-repository.port';
import { KPI_REPOSITORY, type KpiRepositoryPort } from '../domain/ports/kpi-repository.port';
import {
  TENANT_ACCOUNT_TYPE_READER,
  type TenantAccountTypeReaderPort,
} from '../../../shared/tenancy/tenant-account-type.port';

import { isoDay } from './get-kpi-summary.use-case';

/** Janela padrão do consolidado do motorista. */
export const DEFAULT_WINDOW_DAYS = 30;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Desempenho consolidado do **próprio** motorista (ADR-0097).
 *
 * Recebe o login autenticado e resolve a ficha internamente. Lê o período
 * pedido e o imediatamente anterior — este último apenas para derivar a meta,
 * que é a média do próprio motorista. Nenhuma consulta olha para outro
 * motorista: não há como comparar porque não há o que comparar.
 */
@Injectable()
export class GetDriverPerformanceUseCase {
  constructor(
    @Inject(DRIVER_KPI_REPOSITORY) private readonly kpis: DriverKpiRepositoryPort,
    @Inject(KPI_REPOSITORY) private readonly tenantKpis: KpiRepositoryPort,
    @Inject(TENANT_ACCOUNT_TYPE_READER) private readonly contas: TenantAccountTypeReaderPort,
  ) {}

  async execute(
    tenantId: string,
    userId: string,
    windowDays = DEFAULT_WINDOW_DAYS,
  ): Promise<DriverPerformance> {
    const agora = Date.now();
    const from = isoDay(new Date(agora - (windowDays - 1) * DIA_MS));
    const to = isoDay(new Date(agora));
    // Período anterior de mesmo tamanho — a base da meta.
    const baseFrom = isoDay(new Date(agora - (windowDays * 2 - 1) * DIA_MS));
    const baseTo = isoDay(new Date(agora - windowDays * DIA_MS));

    const ler = await this.leitor(tenantId, userId);

    const [atual, anterior] = await Promise.all([ler(from, to), ler(baseFrom, baseTo)]);

    return summarizeDriverPerformance(atual, anterior, from, to);
  }

  /**
   * De onde vêm os números deste login (ADR-0116).
   *
   * Com ficha, do rollup **dele**. Sem ficha, do rollup do tenant — **mas só
   * quando o tenant é de tipo `driver`**, porque é isso que torna verdadeira a
   * frase "o tenant é ele".
   *
   * A versão anterior caía no rollup do tenant só por não haver ficha, e
   * justificava-se com "a organização tem uma pessoa só". A condição e a
   * justificação não são a mesma coisa: um motorista de frota cuja ficha nunca
   * foi ligada satisfaz a condição sem satisfazer a justificação — e via os
   * números da empresa inteira como desempenho pessoal, sem erro nenhum.
   *
   * Sem ficha e em tenant de empresa, a resposta é **vazio**. Um consolidado
   * em branco é honesto: não há nada atribuível a esta pessoa enquanto a ficha
   * não estiver ligada. Mostrar o da empresa é pior do que não mostrar nada.
   */
  private async leitor(
    tenantId: string,
    userId: string,
  ): Promise<(de: string, ate: string) => Promise<DriverDayRow[]>> {
    const ficha = await this.kpis.driverIdForUser(tenantId, userId);
    if (ficha) return (de, ate) => this.kpis.range(tenantId, ficha, de, ate);

    const conta = await this.contas.findAccountType(tenantId);
    if (conta === 'driver') return (de, ate) => this.porTenant(tenantId, de, ate);

    return async () => [];
  }

  /**
   * Motorista autônomo: sem ficha (ADR-0085) e em tenant de tipo `driver`, o
   * tenant é ele, e o rollup do tenant **é** o desempenho dele.
   *
   * O que se perde é `activeMinutes`, que o rollup do tenant não guarda: a
   * sugestão de descanso não aparece para o autônomo. Preferi a ausência a uma
   * estimativa inventada — sugerir pausa com base em número errado corrói a
   * confiança justamente na parte que existe para proteger quem dirige.
   */
  private async porTenant(tenantId: string, from: string, to: string): Promise<DriverDayRow[]> {
    const rows = await this.tenantKpis.range(tenantId, from, to);
    return rows.map((r) => ({
      day: r.day,
      delivered: r.delivered,
      failed: r.failed,
      onTime: r.onTime,
      activeMinutes: 0,
    }));
  }
}
