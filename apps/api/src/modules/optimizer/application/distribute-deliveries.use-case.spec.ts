import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { DeliveryLookupPort } from '../../delivery/application/delivery-lookup.service';
import type { DeliveryWriterPort } from '../../delivery/application/delivery-writer.service';

import { DistributeDeliveriesUseCase } from './distribute-deliveries.use-case';
import type { EnqueueOptimizationUseCase } from './enqueue-optimization.use-case';
import type { DriverRosterLinkPort } from './ports/driver-roster-link.port';

const TENANT = 'tenant-1';
const ATOR = 'login-dispatcher';

function entregas(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `entrega-${i}`,
    latitude: -23.5 + i * 0.01,
    longitude: -46.6,
    priority: 'normal' as const,
    timeWindow: null,
  }));
}

function build(opts: {
  pendentes?: ReturnType<typeof entregas>;
  fichas?: string[];
  assignDriver?: jest.Mock;
  enqueue?: jest.Mock;
  /** Dia completo da ficha; por padrão espelha só o que ela acabou de receber. */
  doDia?: jest.Mock;
}) {
  const listUnassignedActive = jest.fn().mockResolvedValue(opts.pendentes ?? entregas(4));
  const listActiveForDriver =
    opts.doDia ?? jest.fn().mockResolvedValue(entregas(2));
  const deliveries = { listUnassignedActive, listActiveForDriver } as unknown as DeliveryLookupPort;

  const assignDriver = opts.assignDriver ?? jest.fn().mockResolvedValue(true);
  const writer = { assignDriver } as unknown as DeliveryWriterPort;

  const activeDrivers = jest
    .fn()
    .mockResolvedValue(
      (opts.fichas ?? ['ficha-a', 'ficha-b']).map((id) => ({ id, name: `Motorista ${id}` })),
    );
  const roster = { activeDrivers } as unknown as DriverRosterLinkPort;

  const execute =
    opts.enqueue ?? jest.fn().mockImplementation(() => Promise.resolve({ jobId: 'job-1' }));
  const enqueue = { execute } as unknown as EnqueueOptimizationUseCase;

  const record = jest.fn().mockResolvedValue(undefined);
  const audit = { record } as unknown as AuditLogPort;

  return {
    useCase: new DistributeDeliveriesUseCase(deliveries, writer, roster, enqueue, audit),
    assignDriver,
    enqueueExecute: execute,
    record,
    listUnassignedActive,
    listActiveForDriver,
  };
}

describe('DistributeDeliveriesUseCase (ADR-0101)', () => {
  it('reparte as entregas sem dono entre as fichas ativas', async () => {
    const { useCase, assignDriver } = build({ pendentes: entregas(4) });

    const resultado = await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    expect(resultado.assigned).toBe(4);
    expect(resultado.unassigned).toBe(0);
    expect(assignDriver).toHaveBeenCalledTimes(4);
    // Cada entrega recebeu uma ficha, e só fichas ativas.
    for (const [{ driverId }] of assignDriver.mock.calls) {
      expect(['ficha-a', 'ficha-b']).toContain(driverId);
    }
  });

  it('prepara uma rota por motorista que recebeu trabalho', async () => {
    const { useCase, enqueueExecute } = build({ pendentes: entregas(4) });

    const resultado = await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    expect(resultado.shares).toHaveLength(2);
    expect(enqueueExecute).toHaveBeenCalledTimes(2);
    for (const [comando] of enqueueExecute.mock.calls) {
      // A rota nasce carimbada com a ficha (ADR-0098) e no modo inteligente.
      expect(comando.driverId).toBeDefined();
      expect(comando.smart).toBe(true);
      expect(comando.deliveryIds.length).toBeGreaterThanOrEqual(2);
    }
    for (const share of resultado.shares) expect(share.jobId).toBe('job-1');
  });

  it('não enfileira rota para quem ficou com uma parada só — e isso não é falha', async () => {
    const { useCase, enqueueExecute } = build({
      pendentes: entregas(2),
      fichas: ['ficha-a', 'ficha-b'],
      doDia: jest.fn().mockResolvedValue(entregas(1)),
    });

    const resultado = await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    // 2 entregas para 2 motoristas: uma cada, nenhuma rota possível.
    expect(resultado.assigned).toBe(2);
    expect(enqueueExecute).not.toHaveBeenCalled();
    expect(resultado.shares.map((s) => s.jobId)).toEqual([null, null]);
  });

  it('sem ficha ativa, não atribui nada e diz quantas ficaram esperando', async () => {
    const { useCase, assignDriver, record } = build({ pendentes: entregas(5), fichas: [] });

    const resultado = await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    expect(resultado).toEqual({ assigned: 0, unassigned: 5, shares: [] });
    expect(assignDriver).not.toHaveBeenCalled();
    // Não auditou uma distribuição que não aconteceu.
    expect(record).not.toHaveBeenCalled();
  });

  it('sem entrega sem dono, é um no-op — rodar de novo não redistribui nada', async () => {
    const { useCase, assignDriver, enqueueExecute } = build({ pendentes: [] });

    const resultado = await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    expect(resultado).toEqual({ assigned: 0, unassigned: 0, shares: [] });
    expect(assignDriver).not.toHaveBeenCalled();
    expect(enqueueExecute).not.toHaveBeenCalled();
  });

  it('entrega que ganhou dono no meio do caminho não entra na conta', async () => {
    // O despachante atribuiu a primeira à mão entre a leitura e a gravação.
    const assignDriver = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const { useCase } = build({ pendentes: entregas(4), assignDriver });

    const resultado = await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    expect(resultado.assigned).toBe(3);
    expect(resultado.unassigned).toBe(1);
  });

  it('rota que não enfileira não derruba a distribuição já gravada', async () => {
    const enqueue = jest.fn().mockRejectedValue(new Error('fila fora do ar'));
    const { useCase, assignDriver } = build({ pendentes: entregas(4), enqueue });

    const resultado = await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    // As entregas mudaram de dono; só o plano ficou para depois.
    expect(resultado.assigned).toBe(4);
    expect(assignDriver).toHaveBeenCalledTimes(4);
    expect(resultado.shares.every((s) => s.jobId === null)).toBe(true);
  });

  it('audita a distribuição com o que de fato mudou', async () => {
    const { useCase, record } = build({ pendentes: entregas(4) });

    await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        actorId: ATOR,
        action: 'delivery.distributed',
        metadata: expect.objectContaining({ assigned: 4, drivers: 2, candidates: 4 }),
      }),
    );
  });

  it('planeja o DIA INTEIRO do motorista, não só o que ele acabou de receber', async () => {
    // O motorista já carregava 2 entregas; a distribuição lhe dá mais 2. A rota
    // tem de cobrir as 4 — planejar só o incremento faria as antigas sumirem da
    // sequência sem terem sido concluídas.
    const doDia = jest.fn().mockResolvedValue(entregas(4));
    const { useCase, enqueueExecute } = build({
      pendentes: entregas(2),
      fichas: ['ficha-a'],
      doDia,
    });

    await useCase.execute({ tenantId: TENANT, actorId: ATOR });

    expect(doDia).toHaveBeenCalledWith(TENANT, 'ficha-a');
    expect(enqueueExecute.mock.calls[0][0].deliveryIds).toHaveLength(4);
  });

  it('lê candidatas e fichas do tenant do request (isolamento)', async () => {
    const { useCase, listUnassignedActive } = build({});

    await useCase.execute({ tenantId: 'tenant-X', actorId: ATOR });

    expect(listUnassignedActive).toHaveBeenCalledWith('tenant-X');
  });
});
