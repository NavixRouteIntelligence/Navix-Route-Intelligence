import type { DeliveryPriority } from '@navix/contracts';

import { priorityWeight } from './optimization-stop';

/** Boost máximo somado ao peso base quando o prazo está no limite (ADR-0022 Fase 3). */
export const MAX_SLA_BOOST = 4;

/** Horizonte padrão (min): a partir daqui a urgência por SLA começa a crescer. */
export const DEFAULT_SLA_HORIZON_MIN = 120;

/**
 * Peso de prioridade **efetivo** considerando o SLA — priorização dinâmica por
 * urgência (ADR-0022 Fase 3). Combina a prioridade base da entrega com a
 * proximidade do **fim da janela** de entrega: quanto mais perto (ou já
 * estourado) o prazo, maior o peso, empurrando a parada para o início da rota.
 *
 * `windowEndMinutes` = minutos até o fim da janela, relativo à partida (pode ser
 * negativo se já venceu). Sem janela (`null`), devolve o peso base — logo, o
 * comportamento é **idêntico ao legado** quando não há janelas.
 */
export function slaPriorityWeight(
  base: DeliveryPriority,
  windowEndMinutes: number | null,
  horizonMin: number = DEFAULT_SLA_HORIZON_MIN,
): number {
  const w = priorityWeight(base);
  if (windowEndMinutes === null) return w;
  if (windowEndMinutes <= 0) return w + MAX_SLA_BOOST; // prazo vencido/vencendo
  if (windowEndMinutes >= horizonMin) return w; // fora do horizonte de urgência
  const proximity = 1 - windowEndMinutes / horizonMin; // 0..1 conforme aperta
  return w + proximity * MAX_SLA_BOOST;
}
