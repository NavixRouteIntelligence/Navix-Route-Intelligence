import { Queue } from 'bullmq';
import type { DataSource, EntityManager } from 'typeorm';

import type { AppConfigService } from '../src/shared/config/app-config.service';
import { ProcessOptimizationJobUseCase } from '../src/modules/optimizer/application/process-optimization-job.use-case';
import type { OptimizationJobRepositoryPort } from '../src/modules/optimizer/domain/ports/optimization-job-repository.port';
import { BullOptimizationJobQueue } from '../src/modules/optimizer/infrastructure/queue/bull-optimization-job.queue';
import {
  BULL_PREFIX,
  OPTIMIZATION_QUEUE_NAME,
  bullConnection,
} from '../src/modules/optimizer/infrastructure/queue/bull-connection';
import { OptimizationJobWorker } from '../src/modules/optimizer/infrastructure/queue/optimization-job.worker';

/**
 * Integração da fila **contra o Redis de verdade** (ADR-0055/0081).
 *
 * ## Por que este teste existe
 *
 * Os testes unitários da fila usam um mock que **rejeita na hora**; o ioredis
 * real, com `maxRetriesPerRequest: null`, se comporta de outro jeito. Foi
 * exatamente essa diferença que escondeu o defeito do *offline queue* até a
 * revisão. Um mock não prova durabilidade, redelivery nem idempotência — só o
 * Redis prova.
 *
 * ## Isolamento
 *
 * Roda no **banco Redis 15** (`REDIS_DB`), separado do 0 usado por
 * desenvolvimento: o worker de teste consumiria jobs reais se dividisse a fila.
 * A fila é limpa antes de cada caso.
 */
const REDIS_TEST_DB = 15;

function config(overrides: { attempts?: number; backoffMs?: number } = {}): AppConfigService {
  return {
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: REDIS_TEST_DB,
    },
    optimizer: {
      queueDriver: 'bullmq',
      workerEnabled: true,
      jobAttempts: overrides.attempts ?? 3,
      jobBackoffMs: overrides.backoffMs ?? 50,
    },
  } as unknown as AppConfigService;
}

/** Repositório em memória: o foco aqui é o Redis, não o Postgres. */
function jobRepository(): OptimizationJobRepositoryPort & { resets: string[] } {
  const resets: string[] = [];
  return {
    resets,
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    claim: jest.fn().mockResolvedValue(true),
    resetForRetry: jest.fn(async (id: string) => {
      resets.push(id);
      return true;
    }),
  } as unknown as OptimizationJobRepositoryPort & { resets: string[] };
}

/** DataSource falso: executa o callback sem transação real de banco. */
function dataSource(): DataSource {
  const manager = { query: jest.fn().mockResolvedValue([]) } as unknown as EntityManager;
  return {
    transaction: (fn: (m: EntityManager) => Promise<unknown>) => fn(manager),
  } as unknown as DataSource;
}

/** Espera até `check()` virar verdadeiro (aceita checagem assíncrona). */
async function until(
  check: () => boolean | Promise<boolean>,
  timeoutMs = 8000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('condição não satisfeita dentro do prazo');
}

describe('Fila de otimização — integração com Redis real', () => {
  let admin: Queue;
  const started: { close: () => Promise<void> }[] = [];

  beforeAll(() => {
    admin = new Queue(OPTIMIZATION_QUEUE_NAME, {
      connection: bullConnection(config()),
      prefix: BULL_PREFIX,
    });
  });

  beforeEach(async () => {
    // Limpa a fila do banco de teste (nunca toca no db 0, de desenvolvimento).
    await admin.obliterate({ force: true });
  });

  afterEach(async () => {
    for (const s of started.splice(0)) await s.close();
  });

  afterAll(async () => {
    await admin.obliterate({ force: true }).catch(() => undefined);
    await admin.close();
  });

  function startWorker(processor: ProcessOptimizationJobUseCase, jobs = jobRepository()) {
    const worker = new OptimizationJobWorker(config(), dataSource(), processor, jobs);
    worker.onModuleInit();
    started.push({ close: () => worker.onModuleDestroy() });
    return { worker, jobs };
  }

  it('enfileira na API e o worker consome (a otimização sai do processo da API)', async () => {
    const seen: { tenantId: string; jobId: string }[] = [];
    const processor = {
      execute: jest.fn(async (tenantId: string, jobId: string) => {
        seen.push({ tenantId, jobId });
        return true;
      }),
    } as unknown as ProcessOptimizationJobUseCase;

    startWorker(processor);
    const queue = new BullOptimizationJobQueue(config());
    started.push({ close: () => queue.onModuleDestroy() });

    await queue.enqueue('job-1', 'tenant-a');
    await until(() => seen.length > 0);

    expect(seen[0]).toEqual({ tenantId: 'tenant-a', jobId: 'job-1' });
  });

  // A garantia central: o job vive no Redis, não na memória de quem enfileirou.
  it('restart não perde job: enfileirado SEM worker, consumido quando ele sobe', async () => {
    const queue = new BullOptimizationJobQueue(config());
    started.push({ close: () => queue.onModuleDestroy() });

    // Nenhum worker de pé neste instante — como se a API tivesse enfileirado e
    // o processo do worker estivesse reiniciando.
    await queue.enqueue('job-restart', 'tenant-a');
    expect(await admin.getWaitingCount()).toBe(1);

    const seen: string[] = [];
    const processor = {
      execute: jest.fn(async (_t: string, jobId: string) => {
        seen.push(jobId);
        return true;
      }),
    } as unknown as ProcessOptimizationJobUseCase;

    startWorker(processor); // worker sobe depois
    await until(() => seen.includes('job-restart'));
  });

  it('idempotência: reenfileirar o mesmo jobId processa uma vez só', async () => {
    const seen: string[] = [];
    const processor = {
      execute: jest.fn(async (_t: string, jobId: string) => {
        seen.push(jobId);
        return true;
      }),
    } as unknown as ProcessOptimizationJobUseCase;

    const queue = new BullOptimizationJobQueue(config());
    started.push({ close: () => queue.onModuleDestroy() });

    await queue.enqueue('job-dup', 'tenant-a');
    await queue.enqueue('job-dup', 'tenant-a');
    await queue.enqueue('job-dup', 'tenant-a');

    startWorker(processor);
    await until(() => seen.length > 0);
    // Margem para um eventual segundo processamento aparecer, se houvesse.
    await new Promise((r) => setTimeout(r, 600));

    expect(seen).toEqual(['job-dup']);
  });

  it('retry com backoff: falha na 1ª tentativa e conclui na seguinte', async () => {
    let attempts = 0;
    const processor = {
      execute: jest.fn(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('falha transitória');
        return true;
      }),
    } as unknown as ProcessOptimizationJobUseCase;

    const { jobs } = startWorker(processor);
    const queue = new BullOptimizationJobQueue(config());
    started.push({ close: () => queue.onModuleDestroy() });

    await queue.enqueue('job-retry', 'tenant-a');
    await until(() => attempts >= 2);

    expect(await admin.getFailedCount()).toBe(0);
    // A cada entrega o worker desfaz o `running` antes de reprocessar — sem
    // isso o `claim` barraria a segunda tentativa (ADR-0055).
    expect(jobs.resets.filter((id) => id === 'job-retry').length).toBeGreaterThanOrEqual(2);
  });

  it('esgotadas as tentativas, o job termina em failed (não some)', async () => {
    const processor = {
      execute: jest.fn(async () => {
        throw new Error('falha permanente');
      }),
    } as unknown as ProcessOptimizationJobUseCase;

    const worker = new OptimizationJobWorker(
      config({ attempts: 2, backoffMs: 20 }),
      dataSource(),
      processor,
      jobRepository(),
    );
    worker.onModuleInit();
    started.push({ close: () => worker.onModuleDestroy() });

    const queue = new BullOptimizationJobQueue(config({ attempts: 2, backoffMs: 20 }));
    started.push({ close: () => queue.onModuleDestroy() });

    await queue.enqueue('job-dead', 'tenant-a');

    // 2 tentativas configuradas: depois delas o BullMQ move para `failed`.
    await until(() => (processor.execute as jest.Mock).mock.calls.length >= 2);
    await until(async () => (await admin.getFailedCount()) > 0);

    expect(await admin.getFailedCount()).toBe(1);
  });

  it('job ainda não visível no banco é reenfileirado, não descartado', async () => {
    // `execute` devolvendo false = a transação do request ainda não commitou.
    let calls = 0;
    const processor = {
      execute: jest.fn(async () => {
        calls += 1;
        return calls > 1; // some na 1ª, aparece na 2ª
      }),
    } as unknown as ProcessOptimizationJobUseCase;

    startWorker(processor);
    const queue = new BullOptimizationJobQueue(config());
    started.push({ close: () => queue.onModuleDestroy() });

    await queue.enqueue('job-late', 'tenant-a');
    await until(() => calls >= 2);

    expect(await admin.getFailedCount()).toBe(0);
  });
});
