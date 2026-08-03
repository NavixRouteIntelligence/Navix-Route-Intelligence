import { ForbiddenError, NotFoundError } from '../../../shared/kernel/domain-error';
import type { DeliveryGatewayPort } from './ports/delivery-gateway.port';
import type { OptimizationJobQueuePort } from '../domain/ports/optimization-job-queue.port';
import type { OptimizationJobRepositoryPort } from '../domain/ports/optimization-job-repository.port';
import { EnqueueOptimizationUseCase } from './enqueue-optimization.use-case';

/** Gateway de entregas do teste: `ownership` fixo, sem tocar no Delivery. */
function gateway(donos: { id: string; driverId: string | null }[] = []): DeliveryGatewayPort {
  return {
    getStops: jest.fn(),
    listActiveStops: jest.fn(),
    getOwnership: jest.fn().mockResolvedValue(donos),
  };
}

describe('EnqueueOptimizationUseCase', () => {
  it('cria um job "queued", enfileira o processamento e retorna o jobId', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn();
    const jobs: OptimizationJobRepositoryPort = {
      create,
      findById: jest.fn(),
      update: jest.fn(),
      claim: jest.fn(),
      resetForRetry: jest.fn(),
    };
    const queue: OptimizationJobQueuePort = { enqueue };

    const uc = new EnqueueOptimizationUseCase(jobs, queue, gateway());
    const res = await uc.execute({ tenantId: 't1', actorId: 'a1', deliveryIds: ['d1', 'd2'] });

    expect(res.status).toBe('queued');
    expect(res.jobId).toEqual(expect.any(String));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: res.jobId,
        tenantId: 't1',
        status: 'queued',
        request: expect.objectContaining({ actorId: 'a1', deliveryIds: ['d1', 'd2'] }),
      }),
    );
    // O tenantId não vaza para o corpo do request persistido.
    expect(create.mock.calls[0][0].request).not.toHaveProperty('tenantId');
    expect(enqueue).toHaveBeenCalledWith(res.jobId, 't1');
  });

  // Sem isto o cliente receberia 202 com um jobId que nunca sairia de `queued`:
  // a falha de agendamento precisa derrubar o request para que a transação
  // desfaça o job criado (ADR-0081).
  it('propaga a falha de enfileiramento (não responde 202 com job órfão)', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn().mockRejectedValue(new Error('Redis indisponível'));
    const jobs: OptimizationJobRepositoryPort = {
      create,
      findById: jest.fn(),
      update: jest.fn(),
      claim: jest.fn(),
      resetForRetry: jest.fn(),
    };
    const queue: OptimizationJobQueuePort = { enqueue };

    const uc = new EnqueueOptimizationUseCase(jobs, queue, gateway());

    await expect(
      uc.execute({ tenantId: 't1', actorId: 'a1', deliveryIds: ['d1', 'd2'] }),
    ).rejects.toThrow('Redis indisponível');
    expect(create).toHaveBeenCalled(); // criado e desfeito pelo rollback da transação
  });

  // NAV-4.2 / ADR-0099: o motorista só otimiza o que é dele, e a recusa é
  // síncrona — nada de 202 com um job que falha depois.
  describe('ownership (otimização do motorista)', () => {
    const MARIA = 'ficha-maria';
    const JOAO = 'ficha-joao';

    function build(donos: { id: string; driverId: string | null }[]) {
      const create = jest.fn().mockResolvedValue(undefined);
      const enqueue = jest.fn();
      const jobs: OptimizationJobRepositoryPort = {
        create,
        findById: jest.fn(),
        update: jest.fn(),
        claim: jest.fn(),
        resetForRetry: jest.fn(),
      };
      const uc = new EnqueueOptimizationUseCase(jobs, { enqueue }, gateway(donos));
      return { uc, create, enqueue };
    }

    it('enfileira quando todas as entregas são do motorista', async () => {
      const { uc, create } = build([
        { id: 'd1', driverId: MARIA },
        { id: 'd2', driverId: MARIA },
      ]);

      const res = await uc.execute({
        tenantId: 't1',
        actorId: 'a1',
        deliveryIds: ['d1', 'd2'],
        ownership: { driverId: MARIA },
      });

      expect(res.status).toBe('queued');
      expect(create).toHaveBeenCalled();
      // `ownership` é decisão de borda, não pedido: não vai para o job.
      expect(create.mock.calls[0][0].request).not.toHaveProperty('ownership');
    });

    it('entrega de outro motorista do mesmo tenant é recusada com 403', async () => {
      const { uc, create, enqueue } = build([
        { id: 'd1', driverId: MARIA },
        { id: 'd2', driverId: JOAO },
      ]);

      await expect(
        uc.execute({
          tenantId: 't1',
          actorId: 'a1',
          deliveryIds: ['d1', 'd2'],
          ownership: { driverId: MARIA },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      // A recusa acontece ANTES de existir job: nada a limpar depois.
      expect(create).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    });

    // Id de outro tenant não chega ao gateway (a RLS o esconde) e sai como
    // ausente — não se confirma a existência de dado de outra organização.
    it('id invisível ao tenant vira 404', async () => {
      const { uc, create } = build([{ id: 'd1', driverId: MARIA }]);

      await expect(
        uc.execute({
          tenantId: 't1',
          actorId: 'a1',
          deliveryIds: ['d1', 'd-de-outro-tenant'],
          ownership: { driverId: MARIA },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(create).not.toHaveBeenCalled();
    });

    it('o autônomo (sem ficha) otimiza as entregas sem motorista', async () => {
      const { uc, create } = build([
        { id: 'd1', driverId: null },
        { id: 'd2', driverId: null },
      ]);

      await uc.execute({
        tenantId: 't1',
        actorId: 'a1',
        deliveryIds: ['d1', 'd2'],
        ownership: { driverId: null },
      });

      expect(create).toHaveBeenCalled();
    });

    // Sem `ownership` a verificação não roda: é o caminho do despacho, que
    // roteiriza a frota inteira por definição do papel.
    it('a otimização do despacho não é restringida', async () => {
      const { uc, create } = build([{ id: 'd1', driverId: JOAO }]);

      await uc.execute({ tenantId: 't1', actorId: 'a1', deliveryIds: ['d1', 'd2'] });

      expect(create).toHaveBeenCalled();
    });

    // Coordenadas cruas não têm dono a verificar — e não devem ser bloqueadas.
    it('rota por coordenadas passa sem consultar propriedade', async () => {
      const donos = gateway([]);
      const create = jest.fn().mockResolvedValue(undefined);
      const jobs: OptimizationJobRepositoryPort = {
        create,
        findById: jest.fn(),
        update: jest.fn(),
        claim: jest.fn(),
        resetForRetry: jest.fn(),
      };

      await new EnqueueOptimizationUseCase(jobs, { enqueue: jest.fn() }, donos).execute({
        tenantId: 't1',
        actorId: 'a1',
        stops: [
          { id: 's1', latitude: 1, longitude: 1 },
          { id: 's2', latitude: 2, longitude: 2 },
        ],
        ownership: { driverId: MARIA },
      });

      expect(create).toHaveBeenCalled();
      expect(donos.getOwnership).not.toHaveBeenCalled();
    });
  });
});
