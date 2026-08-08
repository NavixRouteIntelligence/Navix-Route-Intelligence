import type { RoutePlan } from './route-plan';

/**
 * O que fazer com um resultado de otimização diante da rota já gravada
 * (ADR-0113).
 *
 * `discard` não é falha: é o desfecho correto de um job que chegou tarde. Quem
 * pediu recebe a rota **vigente**, que é a resposta certa para "qual é a minha
 * rota", ainda que não seja o resultado do cálculo dele.
 */
export type PlanWriteDecision =
  | { action: 'write'; version: number }
  | { action: 'discard'; reason: PlanDiscardReason; winner: RoutePlan };

/**
 * `stale` — o pedido é anterior ao da rota vigente: o resultado nasceu velho.
 * `duplicate` — mesmo instante de pedido: dois pedidos idênticos, e gravar o
 * segundo não acrescenta rota nenhuma, só divide a verdade em duas linhas.
 */
export type PlanDiscardReason = 'stale' | 'duplicate';

/**
 * Decide entre gravar (com a próxima versão) e descartar.
 *
 * A comparação é por `requestedAt` — o **nascimento do pedido** —, e não por
 * conclusão: é o que faz um job lento pedido antes perder para um pedido feito
 * depois, mesmo terminando por último (ADR-0103). A versão é derivada daqui e
 * nunca informada de fora, pela mesma razão que `status` não é (ADR-0110):
 * quem informa pode informar errado.
 *
 * Sem rota vigente, a versão é 1 — a primeira rota do motorista naquele dia.
 */
export function decidePlanWrite(incoming: RoutePlan, current: RoutePlan | null): PlanWriteDecision {
  if (!current) return { action: 'write', version: 1 };

  if (incoming.requestedAt < current.requestedAt) {
    return { action: 'discard', reason: 'stale', winner: current };
  }
  // Empate é duplicata: dois pedidos no mesmo milissegundo descrevem a mesma
  // intenção, e a rota do motorista continua sendo uma só. Antes o empate
  // gravava — "o último a chegar vence" —, o que produzia duas rotas para o
  // mesmo instante e deixava a leitura escolher por ordem de conclusão.
  if (incoming.requestedAt.getTime() === current.requestedAt.getTime()) {
    return { action: 'discard', reason: 'duplicate', winner: current };
  }

  return { action: 'write', version: current.version + 1 };
}

/**
 * Quantas vezes tentar de novo quando outro processo toma a versão no meio.
 *
 * Cada perda de corrida significa que alguém gravou uma versão nova entre a
 * leitura e a escrita — relendo, ou este resultado passa a ser o obsoleto (e
 * é descartado), ou ganha a versão seguinte. Duas tentativas extras cobrem
 * folgadamente o número de processos que disputam a mesma rota; um limite
 * existe para que uma disputa patológica termine em vez de girar.
 */
export const MAX_WRITE_ATTEMPTS = 3;
