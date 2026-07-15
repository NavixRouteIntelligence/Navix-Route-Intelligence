import type { LoadPlanRequest, LoadPlanView } from '@navix/contracts';

/**
 * Organização otimizada da carga (ADR-0030). Port desacoplada: hoje uma
 * heurística LIFO com ocupação/avisos; amanhã um planejador 3D (bin packing) ou
 * modelo aprendido — sem tocar o caso de uso.
 */
export interface LoadPlannerPort {
  plan(input: LoadPlanRequest): LoadPlanView;
}

export const LOAD_PLANNER = Symbol('LOAD_PLANNER');
