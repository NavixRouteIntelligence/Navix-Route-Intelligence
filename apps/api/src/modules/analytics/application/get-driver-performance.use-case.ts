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
import { activeMinutesOf, type DailySubject } from '../domain/daily-subject';
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

    const sujeito = await this.sujeito(tenantId, userId);
    const ler = async (de: string, ate: string): Promise<DriverDayRow[]> => {
      if (!sujeito) return [];
      const linhas = await this.kpis.range(tenantId, sujeito, de, ate);
      return linhas.map((l) => ({
        day: l.day,
        delivered: l.delivered,
        failed: l.failed,
        onTime: l.onTime,
        activeMinutes: activeMinutesOf(l),
      }));
    };

    const [atual, anterior] = await Promise.all([ler(from, to), ler(baseFrom, baseTo)]);

    return summarizeDriverPerformance(atual, anterior, from, to);
  }

  /**
   * Sujeito destes números (ADR-0117).
   *
   * A ficha quando existe; o **login** quando não existe **e** a conta é de
   * motorista — é isso que torna verdadeira a frase "o tenant é ele" (ADR-0116).
   * Sem ficha em conta de empresa, não há sujeito: a resposta é vazia, porque
   * não há nada atribuível àquela pessoa enquanto a ficha não estiver ligada.
   *
   * O rollup do tenant deixou de ser usado aqui. Ele não guarda atividade, e
   * por isso o autónomo recebia `activeMinutes: 0` — um zero que dizia "não
   * trabalhou" quando o que se passava era "não sabemos". Agora o autónomo tem
   * linha própria no read model, projetada pelo login.
   */
  private async sujeito(tenantId: string, userId: string): Promise<DailySubject | null> {
    const ficha = await this.kpis.driverIdForUser(tenantId, userId);
    if (ficha) return { kind: 'driver', driverId: ficha };

    const conta = await this.contas.findAccountType(tenantId);
    return conta === 'driver' ? { kind: 'user', userId } : null;
  }
}
