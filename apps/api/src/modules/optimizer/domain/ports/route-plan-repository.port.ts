import type { PagedResult, PageParams } from '../../../../shared/kernel/pagination';
import type { RoutePlan } from '../route-plan';

/** Port do repositório de route plans. Escopado por `tenantId`. */
export interface RoutePlanRepositoryPort {
  save(plan: RoutePlan): Promise<void>;
  findById(tenantId: string, id: string): Promise<RoutePlan | null>;
  findAll(tenantId: string, page: PageParams): Promise<PagedResult<RoutePlan>>;

  /**
   * Rota vigente de um motorista no dia operacional (ADR-0098).
   *
   * `driverId` nulo é o motorista **autônomo**, que não tem ficha: nesse caso a
   * busca é pelos planos sem motorista do tenant, que é o tenant dele — a
   * organização tem uma pessoa só. Num tenant de frota isso não vaza rota
   * alheia, porque plano de frota também tem `driver_id` nulo e é justamente o
   * que o autônomo nunca cria.
   *
   * Devolve o mais recente do dia, ou `null` quando não há rota preparada.
   */
  findActiveForDriver(
    tenantId: string,
    driverId: string | null,
    operationalDay: string,
  ): Promise<RoutePlan | null>;
  /**
   * A rota vigente de **várias** fichas, numa consulta só (ADR-0101). O painel
   * da frota mostra uma linha por motorista; chamar `findActiveForDriver` num
   * laço seria um N+1 que cresce com o tamanho da equipe.
   *
   * Fichas sem rota do dia simplesmente não aparecem no mapa — ausência é
   * resposta normal, não erro.
   */
  findActiveForDrivers(
    tenantId: string,
    driverIds: string[],
    operationalDay: string,
  ): Promise<Map<string, RoutePlan>>;

  /**
   * Plano mais recente que **contém** a entrega (ADR-0102).
   *
   * É a pergunta certa para o ETA de uma parada: a entrega pertence ao plano
   * que a roteirizou, não ao último plano que o tenant produziu. Numa frota,
   * "o mais recente do tenant" é a rota de alguém — e quase nunca de quem leva
   * esta entrega.
   */
  findLatestContainingDelivery(tenantId: string, deliveryId: string): Promise<RoutePlan | null>;

  /**
   * Rota do motorista no dia com o **pedido** mais recente (ADR-0103).
   *
   * Só olha planos `driverScoped`: é a pergunta "já existe rota deste motorista
   * hoje, e de quando é o pedido dela?", usada para não deixar um job antigo
   * desfazer uma ordem pedida depois. Difere de `findActiveForDriver`, que
   * responde "o que mostrar na tela" e ordena por conclusão.
   */
  findLatestRequestedForDriver(
    tenantId: string,
    driverId: string | null,
    operationalDay: string,
  ): Promise<RoutePlan | null>;
}

export const ROUTE_PLAN_REPOSITORY = Symbol('ROUTE_PLAN_REPOSITORY');
