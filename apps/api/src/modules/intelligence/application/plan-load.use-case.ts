import { Inject, Injectable } from '@nestjs/common';
import type { LoadPlanRequest, LoadPlanView } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { LOAD_PLANNER, type LoadPlannerPort } from '../domain/load-planner.port';

const MAX_ITEMS = 1000;

export interface PlanLoadCommand extends LoadPlanRequest {
  tenantId: string;
}

/**
 * Organização otimizada da carga (ADR-0030). Valida a entrada e delega ao
 * `LoadPlannerPort` (heurística LIFO agora; planejador 3D depois). A capacidade
 * pode vir explícita ou ser derivada do tipo de veículo.
 */
@Injectable()
export class PlanLoadUseCase {
  constructor(@Inject(LOAD_PLANNER) private readonly planner: LoadPlannerPort) {}

  execute(command: PlanLoadCommand): LoadPlanView {
    if (!command.items || command.items.length < 1) {
      throw new ValidationError('É necessário ao menos 1 item para organizar a carga.');
    }
    if (command.items.length > MAX_ITEMS) {
      throw new ValidationError(`Máximo de ${MAX_ITEMS} itens por plano de carga.`);
    }
    const ids = new Set<string>();
    for (const item of command.items) {
      if (ids.has(item.id)) {
        throw new ValidationError(`Item duplicado no plano de carga: ${item.id}.`);
      }
      ids.add(item.id);
    }
    if (command.capacityKg !== undefined && command.capacityKg <= 0) {
      throw new ValidationError('Capacidade de peso deve ser positiva.');
    }
    if (command.capacityVolumeM3 !== undefined && command.capacityVolumeM3 <= 0) {
      throw new ValidationError('Capacidade de volume deve ser positiva.');
    }

    return this.planner.plan({
      items: command.items,
      ...(command.vehicleType !== undefined ? { vehicleType: command.vehicleType } : {}),
      ...(command.capacityKg !== undefined ? { capacityKg: command.capacityKg } : {}),
      ...(command.capacityVolumeM3 !== undefined
        ? { capacityVolumeM3: command.capacityVolumeM3 }
        : {}),
    });
  }
}
