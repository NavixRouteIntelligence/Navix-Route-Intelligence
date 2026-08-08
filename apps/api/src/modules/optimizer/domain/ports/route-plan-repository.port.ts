import type { PagedResult, PageParams } from '../../../../shared/kernel/pagination';
import type { RoutePlan } from '../route-plan';

/**
 * Desfecho de uma gravação (ADR-0113).
 *
 * `version-taken` é o banco recusando: outro processo gravou esta versão da
 * rota deste motorista entre a leitura e a escrita. Não é erro — é a corrida
 * sendo perdida, e quem perde relê e decide de novo.
 */
export type PlanSaveResult = 'saved' | 'version-taken';

/** Port do repositório de route plans. Escopado por `tenantId`. */
export interface RoutePlanRepositoryPort {
  save(plan: RoutePlan): Promise<PlanSaveResult>;
  findById(tenantId: string, id: string): Promise<RoutePlan | null>;
  findAll(tenantId: string, page: PageParams): Promise<PagedResult<RoutePlan>>;

  /**
   * Rota vigente de um motorista no dia operacional (ADR-0098).
   *
   * `driverId` nulo é o motorista **autônomo**, que não tem ficha: nesse caso a
   * busca é pelos planos sem motorista do tenant, que é o tenant dele.
   *
   * Só olha planos `driverScoped` (ADR-0113). O comentário anterior sustentava
   * que plano de frota não vazava aqui "porque é justamente o que o autônomo
   * nunca cria" — ele não cria, mas o despacho do mesmo tenant cria, e plano de
   * frota também tem `driver_id` nulo. Verificado ao vivo: bastava o despacho
   * roteirizar a frota para a rota do autônomo virar o plano do despacho.
   *
   * Devolve a **maior versão** do dia, ou `null` quando não há rota preparada.
   * Antes ordenava por conclusão, que é o critério errado: um job pedido antes
   * e concluído depois aparecia como a rota vigente.
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
