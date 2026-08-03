import type { NodeWindow } from './ports/route-optimization-strategy.port';

/**
 * Relógio da rota diante das janelas horárias (ADR-0104).
 *
 * ## Por que isto é uma função só, usada em três lugares
 *
 * O relógio existe em triplicata: no modelo de custo (que escolhe a ordem), na
 * montagem das paradas (que produz o ETA) e nas métricas (que produzem o total).
 * Enquanto cada um avançava o relógio por conta própria, a janela era
 * decorativa — `startMinutes` era calculado e nunca lido, e chegar três horas
 * antes da abertura não custava nada.
 *
 * Concentrar a regra aqui é o que garante que os três concordem. Se
 * divergirem, o otimizador escolhe uma ordem com base num tempo que o ETA
 * contradiz, e ninguém percebe — o número continua saindo.
 */

/** Chegada a uma parada depois de respeitar a abertura da janela. */
export interface Arrival {
  /** Minuto em que o atendimento realmente começa. */
  serviceStartMinutes: number;
  /** Espera na porta até a janela abrir. Zero quando se chega dentro dela. */
  waitMinutes: number;
  /**
   * O atendimento começa **depois** do fim da janela.
   *
   * Fica como sinalização, não como recusa: a parada continua na rota e o
   * plano a marca. Silenciar seria pior — quem despacha precisa ver que aquela
   * entrega não cabe no combinado, e não descobrir pelo cliente.
   */
  late: boolean;
}

/**
 * Onde o relógio fica ao chegar em `arrivalMinutes`.
 *
 * Chegar antes da abertura **não** antecipa a entrega: o veículo espera. É a
 * diferença entre o plano e a realidade que fazia todo o resto da rota herdar
 * um ETA que nunca ia acontecer.
 */
export function arriveAt(arrivalMinutes: number, window: NodeWindow | null): Arrival {
  if (!window) {
    return { serviceStartMinutes: arrivalMinutes, waitMinutes: 0, late: false };
  }

  const waitMinutes = Math.max(0, window.startMinutes - arrivalMinutes);
  const serviceStartMinutes = arrivalMinutes + waitMinutes;
  // A tolerância absorve ruído de ponto flutuante nos minutos derivados de
  // timestamps; sem ela uma chegada exatamente no limite viraria atraso.
  return {
    serviceStartMinutes,
    waitMinutes,
    late: serviceStartMinutes > window.endMinutes + 1e-6,
  };
}
