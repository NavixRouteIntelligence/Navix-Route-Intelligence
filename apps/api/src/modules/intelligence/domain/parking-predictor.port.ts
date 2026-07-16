import type { ParkingPredictionView } from '@navix/contracts';

import type { LatLng } from '../../../shared/kernel/geo';

/**
 * Previsão de estacionamento no destino (ADR-0029). Port desacoplada: hoje uma
 * heurística por congestionamento, opcionalmente enriquecida pela inteligência
 * coletiva do tenant (ADR-0031/integração B); amanhã um modelo de
 * disponibilidade de vaga — sem tocar o caso de uso. Assíncrona para permitir
 * adaptadores que consultam o histórico da frota (escopo por `tenantId`).
 */
/** Uma parada a prever (id para correlacionar o resultado). */
export interface ParkingPredictInput {
  id: string;
  point: LatLng;
  arrivalAt: Date;
}

export interface ParkingPredictorPort {
  predict(input: { tenantId: string; point: LatLng; arrivalAt: Date }): Promise<ParkingPredictionView>;
  /**
   * Prevê **várias** paradas de uma vez (ADR-0043). Existe para eliminar o N+1
   * do route-forecast: o adaptador ciente da comunidade agrega o histórico em
   * **uma única** consulta por lote de células, em vez de uma por parada.
   */
  predictMany(
    tenantId: string,
    stops: ParkingPredictInput[],
  ): Promise<Map<string, ParkingPredictionView>>;
}

export const PARKING_PREDICTOR = Symbol('PARKING_PREDICTOR');
