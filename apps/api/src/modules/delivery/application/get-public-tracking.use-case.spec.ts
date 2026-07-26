import type { DataSource, EntityManager } from 'typeorm';

import { NotFoundError } from '../../../shared/kernel/domain-error';
import { Delivery } from '../domain/delivery';
import type { DeliveryRepositoryPort } from '../domain/ports/delivery-repository.port';
import type { TrackingTokenRepositoryPort } from '../domain/ports/tracking-token-repository.port';
import type {
  RouteEtaGatewayPort,
  VehicleLocationGatewayPort,
} from './ports/public-tracking-sources.port';
import { GetPublicTrackingUseCase } from './get-public-tracking.use-case';

const TOKEN = 'a'.repeat(43);

/** Grava os `set_config` executados: é como o teste prova que a RLS foi ligada. */
function dataSourceSpy(): { ds: DataSource; tenantSets: string[] } {
  const tenantSets: string[] = [];
  const manager = {
    query: jest.fn((sql: string, params?: unknown[]) => {
      if (sql.includes('app.current_tenant')) tenantSets.push(String(params?.[0]));
      return Promise.resolve([]);
    }),
    getRepository: jest.fn(),
  } as unknown as EntityManager;

  const ds = {
    transaction: (fn: (m: EntityManager) => Promise<unknown>) => fn(manager),
  } as unknown as DataSource;

  return { ds, tenantSets };
}

function delivery(overrides: { status?: string; driverId?: string | null } = {}): Delivery {
  const d = Delivery.create({
    tenantId: 'tenant-a',
    address: {
      street: 'Rua Secreta',
      number: '42',
      city: 'Lisboa',
      state: 'LIS',
      postalCode: '1000-001',
      country: 'PT',
      latitude: 38.72,
      longitude: -9.14,
    },
    timeWindow: { start: new Date().toISOString(), end: new Date(Date.now() + 3.6e6).toISOString() },
    recipient: 'Maria Silva',
    notes: 'Deixar com o porteiro; código do portão 1234',
    driverId: overrides.driverId === undefined ? 'driver-1' : overrides.driverId,
  });
  if (overrides.status === 'in_route') d.changeStatus('in_route');
  if (overrides.status === 'delivered') {
    d.changeStatus('in_route');
    d.changeStatus('delivered');
  }
  return d;
}

function build(opts: {
  resolved?: { deliveryId: string; tenantId: string } | null;
  found?: Delivery | null;
  eta?: Date | null;
  position?: { latitude: number; longitude: number; recordedAt: Date } | null;
}) {
  const { ds, tenantSets } = dataSourceSpy();
  const tokens: TrackingTokenRepositoryPort = {
    resolve: jest.fn().mockResolvedValue(opts.resolved ?? null),
    findActiveByDelivery: jest.fn(),
    issue: jest.fn(),
  };
  const findById = jest.fn().mockResolvedValue(opts.found ?? null);
  const deliveries = { findById } as unknown as DeliveryRepositoryPort;
  const eta: RouteEtaGatewayPort = {
    etaForDelivery: jest.fn().mockResolvedValue(opts.eta ?? null),
  };
  const location: VehicleLocationGatewayPort = {
    latestForDriver: jest.fn().mockResolvedValue(opts.position ?? null),
  };

  return {
    uc: new GetPublicTrackingUseCase(ds, tokens, deliveries, eta, location),
    tenantSets,
    findById,
    location,
    eta,
  };
}

describe('GetPublicTrackingUseCase', () => {
  it('token inválido não chega ao banco e não revela nada', async () => {
    const { uc, findById } = build({ resolved: null });

    await expect(uc.execute(TOKEN)).rejects.toBeInstanceOf(NotFoundError);
    expect(findById).not.toHaveBeenCalled();
  });

  // A garantia central de multi-tenant: sem `app.current_tenant` a RLS devolve
  // zero linhas, então o caso de uso PRECISA ligá-la com o tenant do token.
  it('estabelece app.current_tenant com o tenant do token (RLS)', async () => {
    const { uc, tenantSets, findById } = build({
      resolved: { deliveryId: 'del-1', tenantId: 'tenant-a' },
      found: delivery({ status: 'in_route' }),
    });

    await uc.execute(TOKEN);

    expect(tenantSets).toEqual(['tenant-a']);
    // E a leitura é escopada pelo mesmo tenant, nunca por outro.
    expect(findById).toHaveBeenCalledWith('tenant-a', 'del-1');
  });

  it('não vaza PII: sem endereço, destinatário, observações nem IDs internos', async () => {
    const { uc } = build({
      resolved: { deliveryId: 'del-1', tenantId: 'tenant-a' },
      found: delivery({ status: 'in_route' }),
      position: { latitude: 38.7, longitude: -9.1, recordedAt: new Date() },
    });

    const view = await uc.execute(TOKEN);

    const serialized = JSON.stringify(view);
    for (const secret of [
      'Rua Secreta',
      'Maria Silva',
      'porteiro',
      '1234',
      'del-1',
      'tenant-a',
      'driver-1',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(Object.keys(view).sort()).toEqual([
      'destination',
      'estimatedArrival',
      'etaIsEstimate',
      'status',
      'updatedAt',
      'vehiclePosition',
    ]);
  });

  it('expõe a posição do veículo enquanto está em rota', async () => {
    const recordedAt = new Date('2026-07-24T10:00:00.000Z');
    const { uc } = build({
      resolved: { deliveryId: 'del-1', tenantId: 'tenant-a' },
      found: delivery({ status: 'in_route' }),
      position: { latitude: 38.7, longitude: -9.1, recordedAt },
    });

    const view = await uc.execute(TOKEN);

    expect(view.status).toBe('in_route');
    expect(view.vehiclePosition).toEqual({
      latitude: 38.7,
      longitude: -9.1,
      recordedAt: recordedAt.toISOString(),
    });
  });

  // Rastrear o motorista fora da janela de entrega seria vigilância, não serviço.
  it('NÃO expõe posição quando a entrega não está em rota', async () => {
    const { uc, location } = build({
      resolved: { deliveryId: 'del-1', tenantId: 'tenant-a' },
      found: delivery({ status: 'delivered' }),
      position: { latitude: 38.7, longitude: -9.1, recordedAt: new Date() },
    });

    const view = await uc.execute(TOKEN);

    expect(view.vehiclePosition).toBeNull();
    expect(location.latestForDriver).not.toHaveBeenCalled();
  });

  it('devolve o ETA da heurística e sinaliza que é estimativa', async () => {
    const eta = new Date('2026-07-24T11:30:00.000Z');
    const { uc } = build({
      resolved: { deliveryId: 'del-1', tenantId: 'tenant-a' },
      found: delivery({ status: 'in_route' }),
      eta,
    });

    const view = await uc.execute(TOKEN);

    expect(view.estimatedArrival).toBe(eta.toISOString());
    expect(view.etaIsEstimate).toBe(true);
  });

  it('entrega concluída não mostra ETA (seria um horário no passado)', async () => {
    const { uc, eta } = build({
      resolved: { deliveryId: 'del-1', tenantId: 'tenant-a' },
      found: delivery({ status: 'delivered' }),
      eta: new Date(),
    });

    const view = await uc.execute(TOKEN);

    expect(view.estimatedArrival).toBeNull();
    expect(eta.etaForDelivery).not.toHaveBeenCalled();
  });

  // Entrega apagada (ou de outro tenant, que a RLS esconde) devolve a MESMA
  // resposta de token inexistente — não confirma existência.
  it('token válido cuja entrega sumiu responde como não encontrado', async () => {
    const { uc } = build({
      resolved: { deliveryId: 'del-1', tenantId: 'tenant-a' },
      found: null,
    });

    await expect(uc.execute(TOKEN)).rejects.toBeInstanceOf(NotFoundError);
  });
});
