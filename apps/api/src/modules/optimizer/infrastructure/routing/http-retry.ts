/**
 * Repetição de chamadas ao provedor de rotas (ADR-0132).
 *
 * Partilhado entre a Matrix e a Directions porque a regra é a mesma e ter duas
 * cópias dela seria ter duas: a que se corrige e a que fica para trás.
 */

/**
 * Uma nova tentativa, e só uma.
 *
 * Repetir indefinidamente numa matriz de 81 ladrilhos transformaria um soluço
 * do provedor numa espera de minutos — e o caminho degradado já existe para
 * isso.
 */
export const MAX_ATTEMPTS = 2;
export const RETRY_BACKOFF_MS = 250;

/**
 * Erros que vale a pena repetir.
 *
 * Um `429` ou um `503` costumam passar à segunda. Um `422` **nunca** passa,
 * porque quem está errado é o pedido — repeti-lo é gastar o dobro para receber
 * o mesmo erro, e num ladrilhamento é o dobro vezes oitenta e uma.
 */
export function isTransient(err: unknown): boolean {
  const bruto = err instanceof Error ? err.message : String(err);
  if (/timeout|aborted|AbortError/i.test(bruto)) return true;
  const http = /HTTP (\d{3})/.exec(bruto);
  if (!http) return false;
  const status = Number(http[1]);
  return status === 429 || status >= 500;
}

/** Executa [run], repetindo uma vez quando a falha for transitória. */
export async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await run();
    } catch (err) {
      if (tentativa >= MAX_ATTEMPTS || !isTransient(err)) throw err;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    }
  }
}
