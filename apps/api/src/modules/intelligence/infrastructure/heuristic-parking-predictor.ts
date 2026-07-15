import { Inject, Injectable } from '@nestjs/common';
import type { ParkingPredictionView } from '@navix/contracts';

import type { LatLng } from '../../../shared/kernel/geo';
import { predictParkingFromTraffic } from '../domain/parking-prediction';
import type { ParkingPredictorPort } from '../domain/parking-predictor.port';
import { TRAFFIC_MODEL, type TrafficModelPort } from '../domain/traffic-model';

/**
 * Adaptador heurístico de estacionamento (ADR-0029): reusa o `TrafficModelPort`
 * como proxy de congestionamento. Substituível por um modelo de disponibilidade
 * pela mesma port.
 */
@Injectable()
export class HeuristicParkingPredictor implements ParkingPredictorPort {
  constructor(@Inject(TRAFFIC_MODEL) private readonly traffic: TrafficModelPort) {}

  predict(input: { point: LatLng; arrivalAt: Date }): ParkingPredictionView {
    return predictParkingFromTraffic(this.traffic.factor(input.point, input.arrivalAt));
  }
}
