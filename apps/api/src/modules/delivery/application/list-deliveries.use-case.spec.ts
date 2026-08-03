import type { DeliveryRepositoryPort } from '../domain/ports/delivery-repository.port';

import { ListDeliveriesUseCase, type ListDeliveriesActor } from './list-deliveries.use-case';
import type { FleetGatewayPort } from './ports/fleet-gateway.port';
import type { ListDeliveriesQuery } from './queries/list-deliveries.query';

const FICHA = '11111111-1111-4111-8111-111111111111';
const OUTRA_FICHA = '22222222-2222-4222-8222-222222222222';

function build(ficha: string | null = FICHA) {
  const findAll = jest.fn().mockResolvedValue({ items: [], total: 0 });
  const repo = { findAll } as unknown as DeliveryRepositoryPort;
  const fleet = {
    vehicleExists: jest.fn(),
    driverExists: jest.fn(),
    driverIdForUser: jest.fn().mockResolvedValue(ficha),
  } as FleetGatewayPort;
  return { findAll, fleet, useCase: new ListDeliveriesUseCase(repo, fleet) };
}

function query(filters: ListDeliveriesQuery['filters'] = {}): ListDeliveriesQuery {
  return { page: { page: 1, pageSize: 20 }, filters, sort: [] };
}

const motorista: ListDeliveriesActor = { userId: 'login-1', roles: ['driver'] };

describe('ListDeliveriesUseCase — escopo de propriedade (ADR-0100)', () => {
  it('motorista com ficha só enxerga as entregas da própria ficha', async () => {
    const { useCase, findAll } = build(FICHA);

    await useCase.execute('t1', query(), motorista);

    expect(findAll).toHaveBeenCalledWith('t1', expect.objectContaining({
      filters: expect.objectContaining({ driverId: FICHA }),
    }));
  });

  it('ignora o driverId da query: o motorista não lista a ficha de um colega', async () => {
    const { useCase, findAll } = build(FICHA);

    await useCase.execute('t1', query({ driverId: OUTRA_FICHA }), motorista);

    // Substituído, não combinado: o valor do cliente não chega ao repositório.
    expect(findAll.mock.calls[0][1].filters.driverId).toBe(FICHA);
  });

  it('autônomo (sem ficha) filtra por entregas SEM motorista, não por "sem filtro"', async () => {
    const { useCase, findAll } = build(null);

    await useCase.execute('t1', query(), motorista);

    const { filters } = findAll.mock.calls[0][1];
    expect(filters.driverId).toBeNull();
    // A distinção que importa: `undefined` devolveria o tenant inteiro.
    expect('driverId' in filters).toBe(true);
  });

  it.each([['admin'], ['dispatcher'], ['fleet_manager'], ['api']])(
    'papel %s mantém a visão completa do tenant',
    async (role) => {
      const { useCase, findAll, fleet } = build(FICHA);

      await useCase.execute('t1', query(), { userId: 'login-1', roles: [role] });

      expect(findAll.mock.calls[0][1].filters.driverId).toBeUndefined();
      // Não paga a tradução login→ficha quem não precisa dela.
      expect(fleet.driverIdForUser).not.toHaveBeenCalled();
    },
  );

  it('operação continua podendo filtrar por um motorista específico', async () => {
    const { useCase, findAll } = build(FICHA);

    await useCase.execute('t1', query({ driverId: OUTRA_FICHA }), {
      userId: 'login-admin',
      roles: ['admin'],
    });

    expect(findAll.mock.calls[0][1].filters.driverId).toBe(OUTRA_FICHA);
  });

  it('papel desconhecido falha fechado (escopo de motorista, não visão total)', async () => {
    const { useCase, findAll } = build(null);

    await useCase.execute('t1', query(), { userId: 'login-x', roles: ['papel_novo'] });

    expect(findAll.mock.calls[0][1].filters.driverId).toBeNull();
  });

  it('preserva os demais filtros e a paginação ao impor o escopo', async () => {
    const { useCase, findAll } = build(FICHA);

    await useCase.execute(
      't1',
      { ...query({ status: 'delivered' }), sort: [{ field: 'createdAt', direction: 'DESC' }] },
      motorista,
    );

    const [, q] = findAll.mock.calls[0];
    expect(q.filters).toEqual({ status: 'delivered', driverId: FICHA });
    expect(q.sort).toEqual([{ field: 'createdAt', direction: 'DESC' }]);
    expect(q.page).toEqual({ page: 1, pageSize: 20 });
  });

  it('resolve a ficha no tenant do request (isolamento entre tenants)', async () => {
    const { useCase, fleet } = build(FICHA);

    await useCase.execute('tenant-A', query(), motorista);

    expect(fleet.driverIdForUser).toHaveBeenCalledWith('tenant-A', 'login-1');
  });
});
