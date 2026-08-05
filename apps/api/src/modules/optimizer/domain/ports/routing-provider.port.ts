import type { LatLng } from '../../../../shared/kernel/geo';

/**
 * Matriz de distância (km) e duração (min) entre todos os pares de pontos.
 *
 * Um par **sem rota** vale `UNREACHABLE` (infinito) nas duas matrizes — nunca
 * zero, nunca uma estimativa geométrica (ADR-0106). Zero seria a aresta mais
 * barata do grafo, e o otimizador escolheria justamente as impossíveis; uma
 * estimativa em linha reta fingiria que existe estrada onde não há.
 */
export interface RouteMatrix {
  distanceKm: number[][];
  durationMin: number[][];
}

/**
 * Provedor de roteamento (ADR-0027): fornece a **matriz de distância e duração**
 * entre os pontos. Port desacoplada — o adaptador padrão (Haversine) deriva a
 * duração da velocidade do veículo; um provedor real (Mapbox) devolve **duração
 * de trânsito real**, tornando fiel o Modo Economia por *tempo* (ADR-0026). A
 * troca é por configuração, sem alterar o solver.
 */
export interface RoutingProviderPort {
  /**
   * `speedKmh` é usado pelo fallback para derivar a duração; provedores reais o
   * ignoram (retornam duração medida). Deve ser resiliente: qualquer falha externa
   * cai no cálculo geométrico (Haversine), nunca derruba a otimização.
   */
  matrix(points: LatLng[], speedKmh: number): Promise<RouteMatrix>;
}

export const ROUTING_PROVIDER = Symbol('ROUTING_PROVIDER');
