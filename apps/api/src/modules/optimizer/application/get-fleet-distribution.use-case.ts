import { Inject, Injectable } from '@nestjs/common';
import type { DriverWorkload, FleetDistribution } from '@navix/contracts';

import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../delivery/application/delivery-lookup.service';
import {
  ROUTE_PLAN_REPOSITORY,
  type RoutePlanRepositoryPort,
} from '../domain/ports/route-plan-repository.port';
import { operationalDayOf } from '../domain/route-plan';

import { DRIVER_ROSTER_LINK, type DriverRosterLinkPort } from './ports/driver-roster-link.port';

/**
 * Retrato da distribuição atual da frota (ADR-0101): quem está com o quê, e
 * quanto ainda não tem dono.
 *
 * **Três consultas, não N.** Uma agregação por motorista no banco, uma leitura
 * das fichas ativas e uma busca em lote das rotas do dia. Somar listas
 * paginadas no cliente é justamente o defeito que a ADR-0092 corrigiu no
 * dashboard — os números refletiam só a primeira página, e o erro crescia com
 * o uso. Aqui, o mesmo cuidado desde o começo.
 *
 * Lista **toda** ficha ativa, inclusive quem está com zero: um motorista ocioso
 * é exatamente o que quem despacha precisa enxergar, e ele desapareceria se a
 * lista saísse da agregação de entregas em vez de sair da frota.
 */
@Injectable()
export class GetFleetDistributionUseCase {
  constructor(
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    @Inject(DRIVER_ROSTER_LINK) private readonly roster: DriverRosterLinkPort,
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
  ) {}

  async execute(tenantId: string, at: Date = new Date()): Promise<FleetDistribution> {
    const [carga, fichas] = await Promise.all([
      this.deliveries.countActiveByDriver(tenantId),
      this.roster.activeDrivers(tenantId),
    ]);

    const porFicha = new Map(carga.filter((c) => c.driverId !== null).map((c) => [c.driverId!, c]));
    // O balde sem dono é uma linha da mesma agregação, não uma consulta à parte.
    const semDono = carga.find((c) => c.driverId === null);

    // Mesmo dia operacional que a escrita usa (ADR-0098): se leitura e escrita
    // divergirem, a rota some da tela sem erro nenhum.
    const rotas = await this.plans.findActiveForDrivers(
      tenantId,
      fichas.map((f) => f.id),
      operationalDayOf(at),
    );

    const drivers: DriverWorkload[] = fichas.map((ficha) => {
      const c = porFicha.get(ficha.id);
      const plano = rotas.get(ficha.id)?.snapshot();
      return {
        driverId: ficha.id,
        driverName: ficha.name,
        pending: c?.pending ?? 0,
        inRoute: c?.inRoute ?? 0,
        routePlanId: plano?.id ?? null,
        stops: plano ? plano.stops.length : null,
        distanceKm: plano ? plano.metrics.totalDistanceKm : null,
      };
    });

    return {
      drivers,
      unassigned: semDono ? semDono.pending + semDono.inRoute : 0,
    };
  }
}
