import { Inject, Injectable } from '@nestjs/common';
import type { Delivery as DeliveryView } from '@navix/contracts';

import type { PageParams } from '../../../shared/kernel/pagination';
import { seesWholeTenant } from '../domain/delivery-visibility';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { toDeliveryView } from './mappers/delivery.mapper';
import { FLEET_GATEWAY, type FleetGatewayPort } from './ports/fleet-gateway.port';
import type { ListDeliveriesQuery } from './queries/list-deliveries.query';

export interface ListDeliveriesResult {
  items: DeliveryView[];
  total: number;
  page: PageParams;
}

/** Quem está pedindo a lista. O escopo sai daqui, nunca da query string. */
export interface ListDeliveriesActor {
  /** Login autenticado (`users.id`), não a ficha — a tradução acontece aqui. */
  userId: string;
  roles: readonly string[];
}

@Injectable()
export class ListDeliveriesUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
    @Inject(FLEET_GATEWAY) private readonly fleet: FleetGatewayPort,
  ) {}

  async execute(
    tenantId: string,
    query: ListDeliveriesQuery,
    actor: ListDeliveriesActor,
  ): Promise<ListDeliveriesResult> {
    const filters = await this.scopeFilters(tenantId, query, actor);
    const { items, total } = await this.deliveries.findAll(tenantId, { ...query, filters });
    return { items: items.map(toDeliveryView), total, page: query.page };
  }

  /**
   * Impõe o escopo de propriedade antes de consultar (ADR-0100).
   *
   * O `driverId` da query é filtro escolhido pelo cliente; para o motorista ele
   * é **substituído** pela ficha do próprio login. Substituir em vez de recusar
   * com 403 mantém o cliente existente funcionando — o app e o web já mandam
   * `GET /deliveries` sem filtro algum — e não abre brecha: o valor que chega
   * na query nunca alcança o repositório.
   */
  private async scopeFilters(
    tenantId: string,
    query: ListDeliveriesQuery,
    actor: ListDeliveriesActor,
  ): Promise<ListDeliveriesQuery['filters']> {
    if (seesWholeTenant(actor.roles)) return query.filters;

    // `null` (autônomo, sem ficha) vira "entregas sem motorista atribuído" — e
    // não "nenhum filtro". Ver o comentário em `DeliveryFilters.driverId`.
    const ficha = await this.fleet.driverIdForUser(tenantId, actor.userId);
    return { ...query.filters, driverId: ficha };
  }
}
