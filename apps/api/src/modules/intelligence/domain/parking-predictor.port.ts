import type { ParkingPredictionView } from '@navix/contracts';

import type { LatLng } from '../../../shared/kernel/geo';

/**
 * Previsão de estacionamento no destino (ADR-0029). Port desacoplada: hoje uma
 * heurística por congestionamento; amanhã um modelo de disponibilidade de vaga
 * — sem tocar o caso de uso.
 */
export interface ParkingPredictorPort {
  predict(input: { point: LatLng; arrivalAt: Date }): ParkingPredictionView;
}

export const PARKING_PREDICTOR = Symbol('PARKING_PREDICTOR');
