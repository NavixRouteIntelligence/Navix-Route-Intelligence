/**
 * Limita a espera por uma operação no Redis (ADR-0081/0114).
 *
 * Existe porque a conexão do BullMQ exige `maxRetriesPerRequest: null` e mantém
 * o *offline queue* do ioredis ligado: com o Redis fora, o comando **não
 * rejeita — fica bufferizado esperando reconexão**. Sem um teto, quem espera
 * fica pendurado (uma requisição HTTP segurando transação, um `/ready` que
 * nunca responde, uma subida que nunca conclui nem falha).
 *
 * O `que` entra na mensagem: um timeout que não diz o que expirou obriga quem
 * lê o log a adivinhar qual das operações de fila travou.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, que: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms na ${que}.`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
