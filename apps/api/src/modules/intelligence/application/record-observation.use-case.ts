import { Inject, Injectable } from '@nestjs/common';
import type { RecordObservationRequest, RecordObservationResult } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import { locationCell, type CollectiveObservation } from '../domain/collective-insight';
import {
  COLLECTIVE_INSIGHTS,
  type CollectiveInsightsPort,
} from '../domain/collective-insights.port';

export interface RecordObservationCommand extends RecordObservationRequest {
  tenantId: string;
  driverId: string;
}

const MAX_TIP_LENGTH = 280;
const MAX_SERVICE_MINUTES = 600;

/**
 * Inteligência coletiva (ADR-0031): registra uma observação de campo do
 * motorista (estacionamento, tempo de atendimento ou dica de acesso), atribuída
 * a uma célula de localização, para realimentar as previsões da frota.
 */
@Injectable()
export class RecordObservationUseCase {
  constructor(
    @Inject(COLLECTIVE_INSIGHTS) private readonly store: CollectiveInsightsPort,
  ) {}

  async execute(command: RecordObservationCommand): Promise<RecordObservationResult> {
    const cell = locationCell(command.latitude, command.longitude);
    const observation: CollectiveObservation = {
      id: newId(),
      tenantId: command.tenantId,
      driverId: command.driverId,
      cell,
      latitude: command.latitude,
      longitude: command.longitude,
      kind: command.kind,
      parkingDifficulty: null,
      serviceMinutes: null,
      accessTip: null,
      createdAt: new Date(),
    };

    switch (command.kind) {
      case 'parking':
        if (!command.parkingDifficulty) {
          throw new ValidationError('parkingDifficulty é obrigatório para kind=parking.');
        }
        observation.parkingDifficulty = command.parkingDifficulty;
        break;
      case 'service_time':
        if (
          command.serviceMinutes === undefined ||
          command.serviceMinutes < 0 ||
          command.serviceMinutes > MAX_SERVICE_MINUTES
        ) {
          throw new ValidationError('serviceMinutes inválido para kind=service_time.');
        }
        observation.serviceMinutes = command.serviceMinutes;
        break;
      case 'access': {
        const tip = command.accessTip?.trim();
        if (!tip) {
          throw new ValidationError('accessTip é obrigatório para kind=access.');
        }
        observation.accessTip = tip.slice(0, MAX_TIP_LENGTH);
        break;
      }
      default:
        throw new ValidationError('Tipo de observação desconhecido.');
    }

    await this.store.record(observation);
    return { id: observation.id, cell };
  }
}
