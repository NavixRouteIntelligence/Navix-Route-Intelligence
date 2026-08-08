/**
 * Saúde da fila de otimização (ADR-0114).
 *
 * Três coisas distintas, porque falham separadamente: a **conexão** pode estar
 * de pé sem que o **produtor** consiga enfileirar, e os dois podem estar
 * perfeitos sem que exista **worker** consumindo — caso em que os jobs entram e
 * ninguém os tira, que é a falha mais silenciosa das três.
 */
export interface QueueHealth {
  /** Driver em uso. `inprocess` não é fila: processa no próprio processo. */
  driver: 'bullmq' | 'inprocess';
  /** Nome da fila, para o alerta dizer **qual** fila caiu. */
  queue: string;
  connection: 'up' | 'down';
  producer: 'up' | 'down';
  /**
   * `running` — este processo consome; `remote` — não consome, mas há worker
   * noutro processo; `absent` — ninguém consome, e os jobs se acumulam;
   * `disabled` — não se aplica (fila in-process).
   */
  worker: 'running' | 'remote' | 'absent' | 'disabled';
  /** Workers ligados à fila, vistos pelo Redis. */
  workers?: number;
}

export interface QueueHealthPort {
  health(): Promise<QueueHealth>;
}

export const QUEUE_HEALTH = Symbol('QUEUE_HEALTH');

/**
 * Estado do worker **deste processo** (ADR-0114).
 *
 * Separado de [QueueHealth] de propósito: `getWorkers` responde "existe alguém
 * consumindo em algum lugar", que é a pergunta da frota; esta responde "eu
 * estou consumindo", que é a pergunta que decide se **esta** instância está
 * prestando o serviço que prometeu.
 */
export interface WorkerStatusPort {
  /** `disabled` quando este processo não deve consumir (API sem worker). */
  workerStatus(): 'running' | 'stopped' | 'disabled';
}

export const WORKER_STATUS = Symbol('WORKER_STATUS');
