import type {
  QueueHealth,
  QueueHealthPort,
  WorkerStatusPort,
} from '../optimizer/domain/ports/queue-health.port';

import { QueueHealthIndicator } from './queue.health';

const SAUDAVEL: QueueHealth = {
  driver: 'bullmq',
  queue: 'optimization',
  connection: 'up',
  producer: 'up',
  worker: 'remote',
  workers: 2,
};

function build(saude: Partial<QueueHealth>, workerStatus: 'running' | 'stopped' | 'disabled') {
  const queue: QueueHealthPort = { health: async () => ({ ...SAUDAVEL, ...saude }) };
  const worker: WorkerStatusPort = { workerStatus: () => workerStatus };
  return new QueueHealthIndicator(queue, worker);
}

describe('QueueHealthIndicator', () => {
  it('fila de pé com worker consumindo: pronto', async () => {
    const r = await build({}, 'running');

    await expect(r.check()).resolves.toMatchObject({
      'optimizer-queue': { status: 'up', worker: 'running' },
    });
  });

  // O caso verificado ao vivo: com o Redis fora e `bullmq` configurado, a
  // aplicação subia e o `/ready` respondia 200 com `redis: degraded`. A
  // instância ficava em rotação devolvendo 500 em toda otimização.
  it('sem conexão com a fila, a prontidão cai', async () => {
    const r = build({ connection: 'down', producer: 'down' }, 'running');

    await expect(r.check()).rejects.toThrow(/sem conexão com a fila/);
  });

  it('conexão de pé mas produtor fora também derruba', async () => {
    const r = build({ producer: 'down' }, 'running');

    await expect(r.check()).rejects.toThrow(/produtor indisponível/);
  });

  // Este processo declarou que consome e não está consumindo: está quebrado.
  it('worker habilitado e parado derruba a prontidão deste processo', async () => {
    const r = build({}, 'stopped');

    await expect(r.check()).rejects.toThrow(/worker habilitado mas parado/);
  });

  // A API da topologia dedicada não consome — e não deve ser tirada de rotação
  // por isso, senão um deploy do worker derrubaria também quem só enfileira.
  it('worker desligado neste processo não derruba a API', async () => {
    const r = build({ worker: 'remote', workers: 3 }, 'disabled');

    await expect(r.check()).resolves.toMatchObject({
      'optimizer-queue': { status: 'up', worker: 'remote', workers: 3 },
    });
  });

  // Ninguém consumindo em lugar nenhum é reportado, mas não derruba a API:
  // pode ser um deploy do worker em andamento, e trocar indisponibilidade
  // parcial por total seria pior.
  it('ausência de worker em toda a frota é reportada, não fatal', async () => {
    const r = build({ worker: 'absent', workers: 0 }, 'disabled');

    await expect(r.check()).resolves.toMatchObject({
      'optimizer-queue': { worker: 'absent', workers: 0 },
    });
  });

  it('fila in-process nunca derruba — não há nada externo a cair', async () => {
    const r = build({ driver: 'inprocess', worker: 'disabled' }, 'disabled');

    await expect(r.check()).resolves.toMatchObject({
      'optimizer-queue': { status: 'up', driver: 'inprocess' },
    });
  });

  // Recuperação: o mesmo indicador volta a reportar pronto assim que a fila
  // responde, sem precisar reiniciar nada.
  it('volta a reportar pronto quando a fila se recupera', async () => {
    let caida = true;
    const queue: QueueHealthPort = {
      health: async () =>
        caida ? { ...SAUDAVEL, connection: 'down', producer: 'down' } : SAUDAVEL,
    };
    const indicador = new QueueHealthIndicator(queue, { workerStatus: () => 'running' });

    await expect(indicador.check()).rejects.toThrow();
    caida = false;
    await expect(indicador.check()).resolves.toMatchObject({
      'optimizer-queue': { status: 'up' },
    });
  });
});
