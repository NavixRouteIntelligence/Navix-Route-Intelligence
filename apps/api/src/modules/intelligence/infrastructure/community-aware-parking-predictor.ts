import { Inject, Injectable } from '@nestjs/common';
import type { ParkingPredictionView } from '@navix/contracts';

import type { LatLng } from '../../../shared/kernel/geo';
import { aggregateInsight, locationCell } from '../domain/collective-insight';
import {
  COLLECTIVE_INSIGHTS,
  type CollectiveInsightsPort,
} from '../domain/collective-insights.port';
import { blendParking, predictParkingFromTraffic } from '../domain/parking-prediction';
import type { ParkingPredictorPort } from '../domain/parking-predictor.port';
import { TRAFFIC_MODEL, type TrafficModelPort } from '../domain/traffic-model';

/** Janela de observações consideradas (dias) e teto de linhas por célula. */
const WINDOW_DAYS = 90;
const MAX_OBSERVATIONS = 500;

/**
 * Previsão de estacionamento **ciente da comunidade** (integração B, ADR-0031).
 * Parte da heurística de trânsito (ADR-0029) e a **realimenta** com o que a
 * frota do tenant observou na célula do local — o mundo real corrige o proxy.
 * Degrada para a heurística pura quando não há observações. Substituível por um
 * modelo pela mesma port.
 */
@Injectable()
export class CommunityAwareParkingPredictor implements ParkingPredictorPort {
  constructor(
    @Inject(TRAFFIC_MODEL) private readonly traffic: TrafficModelPort,
    @Inject(COLLECTIVE_INSIGHTS) private readonly insights: CollectiveInsightsPort,
  ) {}

  async predict(input: { tenantId: string; point: LatLng; arrivalAt: Date }): Promise<ParkingPredictionView> {
    const heuristic = predictParkingFromTraffic(this.traffic.factor(input.point, input.arrivalAt));

    const cell = locationCell(input.point.latitude, input.point.longitude);
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const observations = await this.insights.findRecent(
      input.tenantId,
      cell,
      since,
      MAX_OBSERVATIONS,
    );
    const community = aggregateInsight(cell, observations).parking;

    return blendParking(heuristic, community);
  }
}
