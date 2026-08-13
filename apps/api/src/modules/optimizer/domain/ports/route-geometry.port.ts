import type { VehicleType } from '@navix/contracts';

import type { LatLng } from '../../../../shared/kernel/geo';
import type { LineCoordinate } from '../polyline';
import type { RoutingProfile } from '../routing-profile';

/**
 * O traçado real de uma rota, já na ordem em que ela é percorrida.
 */
export interface RouteGeometry {
  /** Vértices da linha, no formato do GeoJSON: **longitude primeiro**. */
  coordinates: LineCoordinate[];
  /** Perfil de deslocamento pedido ao provedor. */
  profile: RoutingProfile;
  /** Quantas paradas a linha percorre. */
  coveredStops: number;
}

/**
 * Provedor do **traçado** da rota — separado do provedor da matriz de propósito.
 *
 * Os dois falam com a Mapbox, mas não são a mesma coisa e não podem partilhar
 * ciclo de vida:
 *
 * - A **matriz** é a entrada do otimizador. Corre antes de haver ordem, é
 *   quadrática no número de paradas e o seu resultado decide o plano. Se falha,
 *   há uma rede de proteção geométrica, porque sem números não há rota nenhuma.
 * - O **traçado** é saída de leitura. Corre depois de a ordem estar decidida,
 *   é linear, e o seu resultado não entra em conta nenhuma. Se falha, o mapa
 *   mostra só os pontos — e a rota funciona à mesma.
 *
 * Juntá-los num port só faria a falha de um contaminar o outro: uma
 * indisponibilidade do traçado passaria a poder derrubar a otimização, e a rede
 * de proteção geométrica da matriz passaria a poder desenhar linhas retas no
 * mapa — que é exatamente o que a ADR-0125 proibiu.
 */
export interface RouteGeometryProviderPort {
  /**
   * O traçado que liga [points] pela ordem dada.
   *
   * **`null` é a resposta certa quando não se consegue o traçado real.** Não há
   * rede de proteção geométrica aqui: uma linha reta entre paradas atravessa
   * quarteirões, rios e sentidos proibidos, e sugere uma distância que não é a
   * que se conduz. Sem traçado, o mapa fica com os pontos, que continuam
   * verdadeiros.
   */
  geometry(points: LatLng[], vehicleType?: VehicleType | null): Promise<RouteGeometry | null>;
}

export const ROUTE_GEOMETRY_PROVIDER = Symbol('ROUTE_GEOMETRY_PROVIDER');
