import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type Job, Worker } from 'bullmq';
import { DataSource } from 'typeorm';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import { transactionContext } from '../../../../shared/database/transaction-context';
import {
  OPTIMIZATION_JOB_REPOSITORY,
  type OptimizationJobRepositoryPort,
} from '../../domain/ports/optimization-job-repository.port';
import { ProcessOptimizationJobUseCase } from '../../application/process-optimization-job.use-case';
import { type OptimizationJobData } from './bull-optimization-job.queue';
import { BULL_PREFIX, OPTIMIZATION_QUEUE_NAME, bullConnection } from './bull-connection';

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
export class OptimizationJobWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('OptimizationJobWorker');
  private worker?: Worker<OptimizationJobData>;

  constructor(
    private readonly config: AppConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly processor: ProcessOptimizationJobUseCase,
    @Inject(OPTIMIZATION_JOB_REPOSITORY) private readonly jobs: OptimizationJobRepositoryPort,
  ) {}

  onModuleInit(): void {
    const { queueDriver, workerEnabled } = this.config.optimizer;
    if (queueDriver !== 'bullmq' || !workerEnabled) return;

    this.worker = new Worker<OptimizationJobData>(
      OPTIMIZATION_QUEUE_NAME,
      (job) => this.process(job),
      { connection: bullConnection(this.config), prefix: BULL_PREFIX, concurrency: CONCURRENCY },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.data.jobId} falhou (tentativa ${job?.attemptsMade}): ${err.message}`);
    });
    // 'error' precisa de listener para não derrubar o processo.
    this.worker.on('error', (err) => this.logger.warn(`Erro no worker: ${err.message}`));
    this.logger.log('Worker de otimização ativo (BullMQ).');
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
