import { Inject, Injectable } from '@nestjs/common';

import { newId } from '../../../shared/kernel/id';
import { locationCell, type CollectiveObservation } from '../domain/collective-insight';
import {
  COLLECTIVE_INSIGHTS,
  type CollectiveInsightsPort,
} from '../domain/collective-insights.port';
import { RefreshCellFeaturesUseCase } from './refresh-cell-features.use-case';

/** Teto de sanidade: acima disto o rastro descreve outra coisa, não uma parada. */
const MAX_SERVICE_MINUTES = 600;

export interface DerivedServiceTimeCommand {
  tenantId: string;
  /** Ficha do motorista — usada para dedupe/anti-abuso, nunca exposta. */
  driverId: string;
  latitude: number;
  longitude: number;
  minutes: number;
}

/**
 * Registra um tempo de atendimento **medido** pelo backend (ADR-0088).
 *
 * É a API pública de escrita do Intelligence para quem mede — hoje o módulo que
 * observa a conclusão da entrega. Existe separada do `RecordObservationUseCase`
 * (a via do cliente) porque as duas gravam procedências diferentes, e é a
 * procedência que decide se o número entra ou não na agregação: só `derived`
 * alimenta o tempo de serviço do otimizador.
 */
@Injectable()
export class RecordDerivedServiceTimeUseCase {
  constructor(
    @Inject(COLLECTIVE_INSIGHTS) private readonly store: CollectiveInsightsPort,
    private readonly refresh: RefreshCellFeaturesUseCase,
  ) {}

  /** Devolve `false` quando o valor não é aproveitável (fora da faixa de sanidade). */
  async execute(command: DerivedServiceTimeCommand): Promise<boolean> {
    if (!(command.minutes > 0) || command.minutes > MAX_SERVICE_MINUTES) return false;

    const observation: CollectiveObservation = {
      id: newId(),
      tenantId: command.tenantId,
      driverId: command.driverId,
      cell: locationCell(command.latitude, command.longitude),
      latitude: command.latitude,
      longitude: command.longitude,
      kind: 'service_time',
      parkingDifficulty: null,
      serviceMinutes: command.minutes,
      accessTip: null,
      source: 'derived',
      createdAt: new Date(),
    };

    await this.store.record(observation);
    // Recalcula só a célula afetada (ADR-0089). `safe`: a observação já está
    // gravada, e uma feature desatualizada por um ciclo custa menos que perder
    // a medição que a originou.
    await this.refresh.safeExecute(command.tenantId, observation.cell);
    return true;
  }
}
