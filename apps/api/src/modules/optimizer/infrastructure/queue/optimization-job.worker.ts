import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type Job, Worker } from 'bullmq';
import { DataSource } from 'typeorm';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import { transactionContext } from '../../../../shared/database/transaction-context';
import {
  OPTIMIZATION_JOB_REPOSITORY,
  type OptimizationJobRepositoryPort,
} from '../../domain/ports/optimization-job-repository.port';
import type { WorkerStatusPort } from '../../domain/ports/queue-health.port';
import { OptimizerMetrics } from '../observability/optimizer-metrics';
import { ProcessOptimizationJobUseCase } from '../../application/process-optimization-job.use-case';
import { type OptimizationJobData } from './bull-optimization-job.queue';
import { BULL_PREFIX, OPTIMIZATION_QUEUE_NAME, bullConnection } from './bull-connection';
import { READY_TIMEOUT_MS } from './bull-optimization-job.queue';
import { withTimeout } from './with-timeout';

/** Um worker processa um job por vez; escala-se por número de processos. */
const CONCURRENCY = 1;

/**
 * Worker BullMQ que consome a fila de otimização (ADR-0055). Reusa
 * `ProcessOptimizationJobUseCase` inteiro — o mesmo processamento da fila
 * in-process — estabelecendo a transação de tenant (com `app.current_tenant`
 * para a RLS), espelhando o `TenantTransactionInterceptor`.
 *
 * **Ativação:** só quando `OPTIMIZER_QUEUE_DRIVER=bullmq` **e**
 * `OPTIMIZER_WORKER_ENABLED=true` (default). Numa topologia com worker dedicado,
 * a API roda com `OPTIMIZER_WORKER_ENABLED=false` (só enfileira) e um processo
 * `main-worker` roda com ele ligado — assim a otimização pesada não disputa CPU
 * com o tráfego HTTP e os dois escalam separadamente.
 */
@Injectable()
export class OptimizationJobWorker
  implements WorkerStatusPort, OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('OptimizationJobWorker');
  private worker?: Worker<OptimizationJobData>;

  constructor(
    private readonly config: AppConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly processor: ProcessOptimizationJobUseCase,
    @Inject(OPTIMIZATION_JOB_REPOSITORY) private readonly jobs: OptimizationJobRepositoryPort,
    private readonly metrics: OptimizerMetrics,
  ) {}

  onModuleInit(): void {
    const { queueDriver, workerEnabled } = this.config.optimizer;
    if (queueDriver !== 'bullmq' || !workerEnabled) return;

    this.worker = new Worker<OptimizationJobData>(
      OPTIMIZATION_QUEUE_NAME,
      (job) => this.process(job),
      { connection: bullConnection(this.config), prefix: BULL_PREFIX, concurrency: CONCURRENCY },
    );
    this.worker.on('failed', (job, err) => this.onFailed(job, err));
    // 'error' precisa de listener para não derrubar o processo.
    this.worker.on('error', (err) => {
      this.metrics.observeQueueError(OPTIMIZATION_QUEUE_NAME, 'connection');
      this.logger.warn(`Erro no worker da fila '${OPTIMIZATION_QUEUE_NAME}': ${err.message}`);
    });
    this.logger.log(`Worker da fila '${OPTIMIZATION_QUEUE_NAME}' ativo (BullMQ).`);
  }

  /**
   * Recusa a subida quando o worker não consegue conectar (ADR-0114).
   *
   * Sem isto, o processo dedicado a consumir a fila subia saudável e ficava
   * mudo: `onModuleInit` só **constrói** o `Worker`, e o ioredis segura os
   * comandos esperando reconexão em vez de rejeitar. Um worker que não consome
   * é indistinguível de uma fila vazia.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.worker) return;
    try {
      await withTimeout(this.worker.waitUntilReady(), READY_TIMEOUT_MS, 'conexão do worker');
    } catch (err) {
      const causa = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Worker da fila '${OPTIMIZATION_QUEUE_NAME}' indisponível (${causa}). ` +
          'Com OPTIMIZER_WORKER_ENABLED=true este processo tem de consumir a ' +
          'fila: verifique REDIS_HOST/REDIS_PORT e se o Redis está no ar.',
      );
    }
  }

  workerStatus(): 'running' | 'stopped' | 'disabled' {
    const { queueDriver, workerEnabled } = this.config.optimizer;
    if (queueDriver !== 'bullmq' || !workerEnabled) return 'disabled';
    return this.worker?.isRunning() ? 'running' : 'stopped';
  }

  /**
   * Uma tentativa que falhou é ruído; a **última** é uma rota que ninguém vai
   * receber (ADR-0114).
   *
   * Enquanto restam tentativas, o BullMQ reenfileira com backoff e o job volta.
   * Esgotadas, o job morre no Redis — e antes a linha em `optimization_jobs`
   * ficava em `running` para sempre, sem erro nenhum, e quem pediu ficava
   * consultando um job que nunca mais mudava de estado.
   */
  private async onFailed(job: Job<OptimizationJobData> | undefined, err: Error): Promise<void> {
    const tentativa = job?.attemptsMade ?? 0;
    const total = job?.opts.attempts ?? this.config.optimizer.jobAttempts;
    const esgotou = tentativa >= total;
    this.metrics.observeQueueJobFailure(
      OPTIMIZATION_QUEUE_NAME,
      esgotou ? 'exhausted' : 'retrying',
    );
    this.logger.error(
      `Job ${job?.data.jobId} falhou na fila '${OPTIMIZATION_QUEUE_NAME}' ` +
        `(tentativa ${tentativa}/${total}${esgotou ? ', esgotada' : ''}): ${err.message}`,
    );
    if (!esgotou || !job) return;

    // Fecha o job no banco, para que quem consulta veja o desfecho em vez de um
    // `running` eterno. Precisa da transação de tenant: a RLS não enxerga a
    // linha sem `app.current_tenant`.
    const { jobId, tenantId } = job.data;
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
        await transactionContext.run(manager, async () => {
          await this.jobs.update(jobId, {
            status: 'failed',
            error: `Esgotadas ${total} tentativas na fila: ${err.message}`,
          });
        });
      });
    } catch (e) {
      this.logger.error(
        `Não foi possível marcar o job ${jobId} como falho: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Exposto para teste: processa um job estabelecendo o contexto de tenant. */
  async process(job: Job<OptimizationJobData>): Promise<void> {
    const { jobId, tenantId } = job.data;
    await this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      await transactionContext.run(manager, async () => {
        // Incondicional: para um job novo é no-op (nada em `running`); para um
        // job redelivered após crash do worker anterior, devolve `running` →
        // `queued` para que o `claim` de execute() volte a valer. Só este worker
        // detém o lock BullMQ do job, então não há corrida com outro consumidor.
        await this.jobs.resetForRetry(jobId);

        const processed = await this.processor.execute(tenantId, jobId);
        if (!processed) {
          // Job ainda não visível (a transação do request pode não ter
          // commitado). Lança para o BullMQ reenfileirar com backoff.
          throw new Error(`Job ${jobId} ainda não visível; reenfileirando.`);
        }
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
