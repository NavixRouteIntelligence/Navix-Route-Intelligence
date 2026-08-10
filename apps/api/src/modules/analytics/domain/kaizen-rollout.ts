import { createHash } from 'node:crypto';

/**
 * Amostragem determinística do rollout (ADR-0124).
 *
 * ## Por que hash, e não sorteio
 *
 * Um `Math.random()` por pedido daria a mesma pessoa a funcionalidade num
 * pedido e não no seguinte — o pior estado possível: um resumo que aparece e
 * desaparece parece uma avaria, não um piloto. O hash do id do utilizador é
 * **estável**: quem está dentro continua dentro enquanto a percentagem não
 * baixar, e quem está fora continua fora.
 *
 * ## Por que só o id, sem sal
 *
 * Sem sal, a mesma pessoa cai no mesmo balde em qualquer ambiente — o que torna
 * um piloto reproduzível: dá para dizer «esta conta está no grupo» antes de
 * ligar seja o que for. O preço é que a ordem de entrada é fixa; subir a
 * percentagem só acrescenta pessoas, nunca troca as que já entraram, e isso é
 * exatamente o que se quer num rollout gradual.
 */

/** Baldes de 0 a 99. Percentagem é inteira: 0,5% não é um piloto, é ruído. */
export function rolloutBucket(userId: string): number {
  const digest = createHash('sha256').update(userId).digest();
  // Dois bytes bastam para 100 baldes e mantêm a distribuição estável.
  return digest.readUInt16BE(0) % 100;
}

/**
 * A pessoa está dentro da amostra?
 *
 * `percent` 0 fecha para todos; 100 abre para todos. É intencional que 100 seja
 * o único valor que dispensa o cálculo: um rollout «completo» não deve depender
 * de nenhuma propriedade do hash.
 */
export function isInRollout(userId: string, percent: number): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  return rolloutBucket(userId) < percent;
}
