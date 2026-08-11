import { Inject, Injectable } from '@nestjs/common';
import type {
  CurrentRouteProgressView,
  CurrentRouteStopView,
  CurrentRouteView,
  RouteGeometryView,
} from '@navix/contracts';

import {
  ROUTE_GEOMETRY_PROVIDER,
  type RouteGeometryProviderPort,
} from '../domain/ports/route-geometry.port';
import { DELIVERY_GATEWAY, type DeliveryGatewayPort } from './ports/delivery-gateway.port';
import { GetActiveRoutePlanUseCase } from './get-active-route-plan.use-case';

/**
 * Rota vigente do próprio motorista, **numa leitura só** (ADR-0127).
 *
 * ## O que isto substitui
 *
 * O app fazia dois pedidos e juntava-os: `/route-plans/mine/active` para o
 * plano, e `/deliveries?pageSize=100&sort=createdAt` para as moradas e os
 * estados. Três problemas, e nenhum deles dava erro:
 *
 * 1. **A página de 100.** Uma parada cuja entrega não estivesse entre as 100
 *    mais antigas perdia morada e estado — e a tela mostrava a parada vazia.
 *    Com mais de 100 entregas no tenant, isso deixa de ser hipótese.
 * 2. **A ordenação global.** `sort=createdAt` é do tenant inteiro, não da rota:
 *    quais paradas apanhavam a janela dependia de quando as entregas de outras
 *    pessoas foram criadas.
 * 3. **Dois instantes.** Entre os dois pedidos uma entrega pode mudar de
 *    estado, e o progresso saía de uma foto que nunca existiu.
 *
 * Aqui as entregas são buscadas **pelos ids que o plano refere** — nem página,
 * nem ordenação —, e o progresso é derivado no servidor.
 */
@Injectable()
export class GetCurrentRouteUseCase {
  constructor(
    private readonly active: GetActiveRoutePlanUseCase,
    @Inject(DELIVERY_GATEWAY) private readonly deliveries: DeliveryGatewayPort,
    @Inject(ROUTE_GEOMETRY_PROVIDER) private readonly geometry: RouteGeometryProviderPort,
  ) {}

  /**
   * `userId` é o **login autenticado**; a ficha é resolvida lá dentro
   * (ADR-0086). Não há parâmetro de motorista: quem pergunta é quem recebe.
   */
  async execute(
    tenantId: string,
    userId: string,
    at = new Date(),
  ): Promise<CurrentRouteView | null> {
    const plano = await this.active.execute(tenantId, userId, at);
    if (!plano) return null;

    const ids = plano.stops.map((s) => s.deliveryId);
    const entregas = await this.deliveries.getRouteStops(tenantId, ids);
    const porId = new Map(entregas.map((e) => [e.id, e]));

    const stops: CurrentRouteStopView[] = plano.stops.map((parada) => {
      const entrega = porId.get(parada.deliveryId);
      // A entrega pode ter sido apagada depois de a rota ser calculada. A
      // parada continua na sequência — sumir com ela mudaria a numeração que o
      // motorista já viu —, mas sem inventar morada nem estado.
      const temLocalizacao = entrega?.latitude != null && entrega?.longitude != null;
      return {
        sequence: parada.sequence,
        deliveryId: parada.deliveryId,
        addressText: entrega?.addressText ?? null,
        status: entrega?.status ?? 'unknown',
        priority: entrega?.priority ?? 'normal',
        timeWindow: entrega?.timeWindow ?? null,
        latitude: temLocalizacao ? entrega!.latitude : null,
        longitude: temLocalizacao ? entrega!.longitude : null,
        hasLocation: temLocalizacao,
        etaMinutes: parada.etaMinutes,
        ...(parada.waitMinutes !== undefined ? { waitMinutes: parada.waitMinutes } : {}),
        ...(parada.timeWindowRespected !== undefined
          ? { timeWindowRespected: parada.timeWindowRespected }
          : {}),
      };
    });

    return {
      planId: plano.id,
      operationalDay: plano.operationalDay,
      status: plano.status,
      departureAt: plano.departureAt,
      // As métricas são as do **plano**, e continuam a ser. O traçado é
      // desenho: a distância que ele percorre não volta para aqui, senão o
      // número que o motorista lê passaria a depender de uma chamada que pode
      // falhar — e mudaria consoante o traçado tivesse vindo ou não.
      metrics: plano.metrics,
      savings: plano.savings,
      params: plano.params,
      stops,
      progress: progressoDe(stops),
      ...(plano.unassignedStops ? { unassignedStops: plano.unassignedStops } : {}),
      geometry: await this.tracado(stops, plano.params?.vehicleType ?? null),
    };
  }

  /**
   * O traçado da rota, ou `null`.
   *
   * Corre **depois** de a ordem estar decidida e nunca a influencia: recebe a
   * sequência do plano tal como ela é e devolve uma linha. Nada do que sai
   * daqui volta para o otimizador nem para as métricas.
   *
   * Qualquer falha vira `null` e não sobe: a rota carrega na mesma. Uma linha
   * indisponível não pode impedir alguém de ver as suas entregas.
   */
  private async tracado(
    stops: readonly CurrentRouteStopView[],
    vehicleType: CurrentRouteView['params']['vehicleType'] | null,
  ): Promise<RouteGeometryView | null> {
    // Paradas sem localização não entram na linha — não há por onde a passar.
    // Elas continuam na lista e na numeração; é a linha que as salta, e é por
    // isso que a proveniência conta as duas coisas.
    const comLocal = stops.filter((s) => s.hasLocation);
    if (comLocal.length < 2) return null;

    try {
      const linha = await this.geometry.geometry(
        comLocal.map((s) => ({ latitude: s.latitude!, longitude: s.longitude! })),
        vehicleType ?? null,
      );
      if (!linha) return null;

      return {
        coordinates: linha.coordinates,
        provenance: {
          source: 'directions',
          profile: linha.profile,
          coveredStops: linha.coveredStops,
          totalStops: stops.length,
        },
      };
    } catch {
      // O provedor já devolve `null` em falha; isto é a rede para o caso de um
      // adaptador futuro lançar. A rota vale mais do que a linha.
      return null;
    }
  }
}

/**
 * Progresso derivado da mesma lista que a tela desenha.
 *
 * Derivar aqui, e não no app, é o que garante que o «3 de 12» e a lista contam
 * a mesma história: eram duas contas em dois sítios, e a do app dependia de a
 * junção ter acertado.
 */
function progressoDe(stops: readonly CurrentRouteStopView[]): CurrentRouteProgressView {
  const concluidas = stops.filter((s) => s.status === 'delivered').length;
  const falhadas = stops.filter((s) => s.status === 'failed').length;
  // A próxima é a primeira **na ordem do plano** que ainda não terminou.
  const proxima = stops.find((s) => s.status !== 'delivered' && s.status !== 'failed');

  return {
    total: stops.length,
    completed: concluidas,
    failed: falhadas,
    pending: stops.length - concluidas - falhadas,
    nextDeliveryId: proxima?.deliveryId ?? null,
    withoutLocation: stops.filter((s) => !s.hasLocation).length,
  };
}
