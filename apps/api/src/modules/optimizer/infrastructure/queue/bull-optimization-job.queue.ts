import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type { OptimizationJobQueuePort } from '../../domain/ports/optimization-job-queue.port';
import type { QueueHealth, QueueHealthPort } from '../../domain/ports/queue-health.port';
import { BULL_PREFIX, OPTIMIZATION_QUEUE_NAME, bullConnection } from './bull-connection';
import { withTimeout } from './with-timeout';

/** Dados carregados por cada job BullMQ — suficientes para reprocessar sozinho. */
export interface OptimizationJobData {
  jobId: string;
  tenantId: string;
}

/**
 * Teto para o `add` no Redis. **Necessário porque o `enqueue` é aguardado
 * dentro da transação do request:** a conexão do BullMQ exige
 * `maxRetriesPerRequest: null` e mantém o *offline queue* do ioredis ligado, de
 * modo que, com o Redis fora, o comando **não rejeita — fica bufferizado
 * esperando reconexão**. Sem este teto, a requisição HTTP ficaria pendurada
 * segurando uma transação de banco aberta (pressão no pool). Ver ADR-0081.
 */
export const ENQUEUE_TIMEOUT_MS = 5000;

/**
 * Teto para a verificação de fila na **subida** (ADR-0114). Mais generoso que o
 * do `enqueue` porque um Redis reiniciando junto com a aplicação merece alguns
 * segundos — mas finito, porque subir "quase pronto" e ficar esperando é
 * indistinguível, de fora, de um processo travado.
 */
export const READY_TIMEOUT_MS = 10_000;

/** Teto da consulta de saúde: `/ready` não pode pendurar por causa do Redis. */
export const HEALTH_TIMEOUT_MS = 1500;

/**
 * Adaptador **BullMQ** do `OptimizationJobQueuePort` (ADR-0055). Diferente da
 * fila in-process, o job é **persistido no Redis**: sobrevive a reinícios do
 * processo, tem retry com backoff exponencial e redelivery em caso de crash do
 * worker — tudo nativo do BullMQ. O `tenantId` viaja no próprio job, então o
 * worker reprocessa sem precisar varrer o banco entre tenants (o que exigiria
 * furar a RLS).
 *
 * Só é instanciado quando `OPTIMIZER_QUEUE_DRIVER=bullmq` (ver módulo).
 */
@Injectable()
export class BullOptimizationJobQueue
  implements OptimizationJobQueuePort, QueueHealthPort, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('OptimizationJobQueue');
  private readonly queue: Queue<OptimizationJobData>;

  constructor(config: AppConfigService) {
    const { jobAttempts, jobBackoffMs } = config.optimizer;
    this.queue = new Queue<OptimizationJobData>(OPTIMIZATION_QUEUE_NAME, {
      connection: bullConnection(config),
      prefix: BULL_PREFIX,
      defaultJobOptions: {
        attempts: jobAttempts,
        backoff: { type: 'exponential', delay: jobBackoffMs },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  /**
   * Recusa a subida quando a fila não responde (ADR-0114).
   *
   * Antes, com o Redis fora, a aplicação subia, respondia `/ready` com 200 e
   * falhava **uma requisição por vez** — a instância entrava em rotação para
   * devolver 500 em toda otimização. Escolher `bullmq` é declarar a fila
   * obrigatória; se ela não está lá, não há serviço a prestar.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await withTimeout(this.queue.waitUntilReady(), READY_TIMEOUT_MS, 'conexão com a fila');
    } catch (err) {
      const causa = err instanceof Error ? err.message : String(err);
      this.logger.error(`Fila '${OPTIMIZATION_QUEUE_NAME}' indisponível na subida: ${causa}`);
      throw new Error(
        `Fila de otimização '${OPTIMIZATION_QUEUE_NAME}' indisponível (${causa}). ` +
          'Com OPTIMIZER_QUEUE_DRIVER=bullmq a fila é obrigatória: verifique ' +
          'REDIS_HOST/REDIS_PORT e se o Redis está no ar.',
      );
    }
    this.logger.log(`Fila '${OPTIMIZATION_QUEUE_NAME}' pronta (BullMQ).`);
  }

  /**
   * Conexão, produtor e worker (ADR-0114).
   *
   * O `getJobCounts` é o teste do **produtor**: responde se a fila é legível e
   * gravável com o prefixo configurado, o que um `ping` de conexão não diz. E
   * `getWorkers` responde a pergunta que ninguém fazia — se existe alguém
   * consumindo, em qualquer processo.
   */
  async health(): Promise<QueueHealth> {
    const base = {
      driver: 'bullmq' as const,
      queue: OPTIMIZATION_QUEUE_NAME,
      worker: 'absent' as const,
    };
    try {
      // `getJobCounts` não é usado pelo resultado: ele **é** o teste do
      // produtor — só responde se a fila for legível com o prefixo configurado.
      const [, workers] = await withTimeout(
        Promise.all([this.queue.getJobCounts(), this.queue.getWorkers()]),
        HEALTH_TIMEOUT_MS,
        'saúde da fila',
      );
      return {
        ...base,
        connection: 'up',
        producer: 'up',
        workers: workers.length,
        worker: workers.length > 0 ? 'remote' : 'absent',
      };
    } catch {
      return { ...base, connection: 'down', producer: 'down' };
    }
  }

  async enqueue(jobId: string, tenantId: string): Promise<void> {
    // `jobId` como id do BullMQ torna o enqueue idempotente: reenfileirar o
    // mesmo job (ex.: reotimização, ou um retry do request) não cria duplicata.
    //
    // A rejeição é PROPAGADA de propósito. Antes o erro era só logado e o
    // request seguia respondendo 202: com o Redis fora, o job ficava `queued`
    // no banco para sempre, invisível, e nem um restart o recuperava. Deixando
    // estourar, a transação do request desfaz a criação do job e o cliente
    // recebe o erro na hora (ADR-0081).
    try {
      await withTimeout(
        this.queue.add('optimize', { jobId, tenantId }, { jobId }),
        ENQUEUE_TIMEOUT_MS,
        `enfileiramento do job ${jobId}`,
      );
    } catch (err) {
      this.logger.error(
        `Falha ao enfileirar job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
