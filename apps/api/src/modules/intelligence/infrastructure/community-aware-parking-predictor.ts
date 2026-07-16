import { Inject, Injectable } from '@nestjs/common';
import type { ParkingPredictionView } from '@navix/contracts';

import type { LatLng } from '../../../shared/kernel/geo';
import { aggregateInsight, locationCell } from '../domain/collective-insight';
import {
  COLLECTIVE_INSIGHTS,
  type CollectiveInsightsPort,
} from '../domain/collective-insights.port';
import { blendParking, predictParkingFromTraffic } from '../domain/parking-prediction';
import type { ParkingPredictInput, ParkingPredictorPort } from '../domain/parking-predictor.port';
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

  /**
   * Versão em lote (ADR-0043): busca o histórico de **todas** as células numa
   * única consulta (`findRecentByCells`) e agrega por célula em memória —
   * elimina o N+1 do route-forecast (antes: uma consulta por parada).
   */
  async predictMany(
    tenantId: string,
    stops: ParkingPredictInput[],
  ): Promise<Map<string, ParkingPredictionView>> {
    const out = new Map<string, ParkingPredictionView>();
    if (stops.length === 0) return out;

    const cellOf = new Map<string, string>();
    for (const s of stops) cellOf.set(s.id, locationCell(s.point.latitude, s.point.longitude));

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const distinctCells = [...new Set(cellOf.values())];
    const observations = await this.insights.findRecentByCells(
      tenantId,
      distinctCells,
      since,
      MAX_OBSERVATIONS,
    );

    // Agrupa as observações por célula e agrega o estacionamento comunitário.
    const byCell = new Map<string, typeof observations>();
    for (const o of observations) {
      const list = byCell.get(o.cell) ?? [];
      list.push(o);
      byCell.set(o.cell, list);
    }
    const communityByCell = new Map<string, ReturnType<typeof aggregateInsight>['parking']>();
    for (const cell of distinctCells) {
      communityByCell.set(cell, aggregateInsight(cell, byCell.get(cell) ?? []).parking);
    }

    for (const s of stops) {
      const heuristic = predictParkingFromTraffic(this.traffic.factor(s.point, s.arrivalAt));
      const cell = cellOf.get(s.id)!;
      out.set(s.id, blendParking(heuristic, communityByCell.get(cell)));
    }
    return out;
  }
}
