import { Injectable } from '@nestjs/common';
import type { LoadPlanRequest, LoadPlanView } from '@navix/contracts';

import { planLoad } from '../domain/load-planner';
import type { LoadPlannerPort } from '../domain/load-planner.port';

/**
 * Adaptador heurístico de organização da carga (ADR-0030): delega ao planejador
 * LIFO puro. Substituível por um planejador 3D/bin packing pela mesma port.
 */
@Injectable()
export class HeuristicLoadPlanner implements LoadPlannerPort {
  plan(input: LoadPlanRequest): LoadPlanView {
    return planLoad(input);
  }
}
