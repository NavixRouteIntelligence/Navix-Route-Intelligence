import type { AppConfigService } from '../../../../shared/config/app-config.service';
import {
  BullOptimizationJobQueue,
  ENQUEUE_TIMEOUT_MS,
  READY_TIMEOUT_MS,
} from './bull-optimization-job.queue';
import { BULL_PREFIX, OPTIMIZATION_QUEUE_NAME } from './bull-connection';

// Mock do BullMQ: o teste verifica o CONTRATO que passamos à fila (durabilidade,
// retry/backoff, idempotência), não a implementação do Redis.
const add = jest.fn();
const close = jest.fn();
const queueCtor = jest.fn();
const waitUntilReady = jest.fn();
const getJobCounts = jest.fn();
const getWorkers = jest.fn();

jest.mock('bullmq', () => ({
  Queue: class {
    constructor(name: string, opts: unknown) {
      queueCtor(name, opts);
    }
    add = add;
    close = close;
    waitUntilReady = waitUntilReady;
    getJobCounts = getJobCounts;
    getWorkers = getWorkers;
  },
}));

function config(
  overrides: Partial<{ jobAttempts: number; jobBackoffMs: number }> = {},
): AppConfigService {
  return {
    optimizer: { jobAttempts: 3, jobBackoffMs: 1000, ...overrides },
    redis: { host: 'localhost', port: 6379, password: '' },
  } as unknown as AppConfigService;
}

describe('BullOptimizationJobQueue', () => {
  beforeEach(() => {
    add.mockReset().mockResolvedValue({ id: 'job-1' });
    close.mockReset().mockResolvedValue(undefined);
    queueCtor.mockReset();
    waitUntilReady.mockReset().mockResolvedValue(undefined);
    getJobCounts.mockReset().mockResolvedValue({ waiting: 0, active: 0 });
    getWorkers.mockReset().mockResolvedValue([{ id: 'w1' }]);
  });

  it('configura a fila para sobreviver a restart: retry com backoff exponencial', () => {
    new BullOptimizationJobQueue(config({ jobAttempts: 5, jobBackoffMs: 250 }));

    expect(queueCtor).toHaveBeenCalledWith(
      OPTIMIZATION_QUEUE_NAME,
      expect.objectContaining({
        prefix: BULL_PREFIX,
        defaultJobOptions: expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 250 },
        }),
      }),
    );
  });

  it('enfileira com o tenantId embarcado (o worker reprocessa sem varrer o banco)', async () => {
    const queue = new BullOptimizationJobQueue(config());

    await queue.enqueue('job-1', 'tenant-a');

    expect(add).toHaveBeenCalledWith(
      'optimize',
      { jobId: 'job-1', tenantId: 'tenant-a' },
      expect.objectContaining({ jobId: 'job-1' }),
    );
  });

  // Idempotência: o jobId do domínio vira o id do BullMQ, então reenfileirar o
  // mesmo job (reotimização, retry do request) não duplica o processamento.
  it('usa o jobId do domínio como id do BullMQ (enqueue idempotente)', async () => {
    const queue = new BullOptimizationJobQueue(config());

    await queue.enqueue('job-1', 'tenant-a');
    await queue.enqueue('job-1', 'tenant-a');

    expect(add).toHaveBeenCalledTimes(2);
    const ids = add.mock.calls.map((c) => (c[2] as { jobId: string }).jobId);
    expect(ids).toEqual(['job-1', 'job-1']); // mesmo id => o BullMQ deduplica
  });

  // Antes o erro era engolido e o request respondia 202: o job ficava `queued`
  // para sempre e nem um restart o recuperava (ADR-0081).
  it('propaga a falha do Redis em vez de engolir (evita job órfão)', async () => {
    add.mockRejectedValue(new Error('ECONNREFUSED'));
    const queue = new BullOptimizationJobQueue(config());

    await expect(queue.enqueue('job-1', 'tenant-a')).rejects.toThrow('ECONNREFUSED');
  });

  // O caso que o mock "rejeita na hora" NÃO cobre e que motivou o timeout: com
  // o Redis fora, a conexão do BullMQ (maxRetriesPerRequest: null + offline
  // queue ligado) NÃO rejeita — bufferiza esperando reconexão. Como o enqueue é
  // aguardado dentro da transação do request, sem teto a requisição ficaria
  // pendurada segurando uma transação aberta (ADR-0081).
  it('não espera para sempre quando o Redis não responde (Redis fora)', async () => {
    jest.useFakeTimers();
    try {
      add.mockReturnValue(new Promise(() => undefined)); // nunca resolve, como o offline queue
      const queue = new BullOptimizationJobQueue(config());

      const enqueued = queue.enqueue('job-1', 'tenant-a');
      const assertion = expect(enqueued).rejects.toThrow(/Timeout de \d+ms/);

      await jest.advanceTimersByTimeAsync(ENQUEUE_TIMEOUT_MS);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('fecha a conexão no shutdown (não vaza cliente Redis)', async () => {
    const queue = new BullOptimizationJobQueue(config());

    await queue.onModuleDestroy();

    expect(close).toHaveBeenCalled();
  });

  // NAV-4.14 / ADR-0114: escolher `bullmq` é declarar a fila obrigatória.
  describe('indisponibilidade e recuperação (ADR-0114)', () => {
    it('sobe quando a fila responde', async () => {
      const q = new BullOptimizationJobQueue(config());

      await expect(q.onApplicationBootstrap()).resolves.toBeUndefined();
    });

    it('recusa a subida quando a fila não responde', async () => {
      waitUntilReady.mockRejectedValue(new Error('ECONNREFUSED'));
      const q = new BullOptimizationJobQueue(config());

      await expect(q.onApplicationBootstrap()).rejects.toThrow(/indisponível/);
    });

    // O modo de falha que motiva o teto: o ioredis **bufferiza** o comando em
    // vez de rejeitar, então esperar sem limite é esperar para sempre.
    it('a espera pela fila tem teto — Redis fora não pendura a subida', async () => {
      waitUntilReady.mockReturnValue(new Promise(() => undefined));
      const q = new BullOptimizationJobQueue(config());

      jest.useFakeTimers();
      const subida = q.onApplicationBootstrap();
      const esperado = expect(subida).rejects.toThrow(/Timeout/);
      await jest.advanceTimersByTimeAsync(READY_TIMEOUT_MS + 10);
      await esperado;
      jest.useRealTimers();
    });

    it('a mensagem diz o que verificar, não só que falhou', async () => {
      waitUntilReady.mockRejectedValue(new Error('ECONNREFUSED'));
      const q = new BullOptimizationJobQueue(config());

      await expect(q.onApplicationBootstrap()).rejects.toThrow(/REDIS_HOST/);
    });

    it('saúde reporta conexão, produtor e quantos workers consomem', async () => {
      const q = new BullOptimizationJobQueue(config());

      await expect(q.health()).resolves.toEqual({
        driver: 'bullmq',
        queue: OPTIMIZATION_QUEUE_NAME,
        connection: 'up',
        producer: 'up',
        worker: 'remote',
        workers: 1,
      });
    });

    // Fila legível e gravável, e ninguém consumindo: os jobs entram e ficam.
    it('sem worker algum, a saúde diz `absent` em vez de `up` genérico', async () => {
      getWorkers.mockResolvedValue([]);
      const q = new BullOptimizationJobQueue(config());

      await expect(q.health()).resolves.toMatchObject({ worker: 'absent', workers: 0 });
    });

    it('fila fora derruba conexão e produtor juntos', async () => {
      getJobCounts.mockRejectedValue(new Error('ECONNREFUSED'));
      const q = new BullOptimizationJobQueue(config());

      await expect(q.health()).resolves.toMatchObject({
        connection: 'down',
        producer: 'down',
      });
    });

    it('recupera sem reiniciar: a saúde volta a `up` quando a fila volta', async () => {
      getJobCounts.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const q = new BullOptimizationJobQueue(config());

      await expect(q.health()).resolves.toMatchObject({ connection: 'down' });
      await expect(q.health()).resolves.toMatchObject({ connection: 'up' });
    });
  });
});
