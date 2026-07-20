import { Inject, Injectable } from '@nestjs/common';

import {
  COLLECTIVE_SERVICE_TIMES,
  type CollectiveServiceTimeLookupPort,
} from '../../../intelligence/application/collective-service-time.lookup';
import type {
  ServiceTimeHistoryPoint,
  ServiceTimeHistoryPort,
} from '../../application/ports/service-time-history.port';

/**
 * Adaptador anti-corrupção: única ponte do Optimizer para o histórico de tempo
 * de serviço do Intelligence (Inteligência Coletiva). Consome a API pública
 * (`COLLECTIVE_SERVICE_TIMES`) — sem acessar internals daquele módulo (ADR-0065).
 */
@Injectable()
export class IntelligenceServiceTimeHistory implements ServiceTimeHistoryPort {
  constructor(
    @Inject(COLLECTIVE_SERVICE_TIMES) private readonly lookup: CollectiveServiceTimeLookupPort,
  ) {}

  typicalServiceMinutes(
    tenantId: string,
    points: ServiceTimeHistoryPoint[],
  ): Promise<(number | null)[]> {
    return this.lookup.typicalServiceMinutes(tenantId, points);
  }
}
