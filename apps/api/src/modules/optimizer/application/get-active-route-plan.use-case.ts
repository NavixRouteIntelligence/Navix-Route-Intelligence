import { Inject, Injectable } from '@nestjs/common';
import type { RoutePlan as RoutePlanView } from '@navix/contracts';

import {
  ROUTE_PLAN_REPOSITORY,
  type RoutePlanRepositoryPort,
} from '../domain/ports/route-plan-repository.port';
import {
  TENANT_TIME_ZONE_READER,
  type TenantTimeZoneReaderPort,
} from '../../../shared/tenancy/tenant-time-zone.port';
import { operationalDayOf } from '../domain/route-plan';

import { DRIVER_ROSTER_LINK, type DriverRosterLinkPort } from './ports/driver-roster-link.port';
import { toRoutePlanView } from './route-plan.mapper';

/**
 * Rota vigente do **próprio** motorista (ADR-0098).
 *
 * Substitui a regra que vivia espalhada pelos clientes — "o plano mais recente
 * do tenant, `pageSize=1`" —, que numa frota entregava a mesma rota a todo
 * mundo. Recebe o login e resolve a ficha aqui: o cliente não escolhe de quem é
 * a rota, e não existe parâmetro que permita pedir a de outra pessoa.
 *
 * O dia operacional é derivado com a **mesma** função usada na criação do
 * plano. Que fuso se escolhe importa menos do que escrita e leitura
 * concordarem; hoje ambas usam UTC.
 */
@Injectable()
export class GetActiveRoutePlanUseCase {
  constructor(
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
    @Inject(DRIVER_ROSTER_LINK) private readonly roster: DriverRosterLinkPort,
    @Inject(TENANT_TIME_ZONE_READER) private readonly zones: TenantTimeZoneReaderPort,
  ) {}

  async execute(
    tenantId: string,
    userId: string,
    at: Date = new Date(),
  ): Promise<RoutePlanView | null> {
    const ficha = await this.roster.driverIdForUser(tenantId, userId);
    // Mesmo fuso da escrita (ADR-0105): se divergirem, a rota some da tela sem
    // erro nenhum — é a invariante que a ADR-0098 deixou registrada.
    const timeZone = await this.zones.findTimeZone(tenantId);
    const plan = await this.plans.findActiveForDriver(
      tenantId,
      ficha,
      operationalDayOf(at, timeZone),
    );
    return plan ? toRoutePlanView(plan) : null;
  }
}
