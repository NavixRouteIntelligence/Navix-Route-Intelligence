import type { LatLng } from '../../../../shared/kernel/geo';

/** Matriz de distância (km) e duração (min) entre todos os pares de pontos. */
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
