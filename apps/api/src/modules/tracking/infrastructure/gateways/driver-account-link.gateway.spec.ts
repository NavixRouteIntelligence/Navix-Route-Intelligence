import type { FleetLookupPort } from '../../../fleet/application/fleet-lookup.service';
import { DriverAccountLinkGateway } from './driver-account-link.gateway';

const TENANT = 'tenant-a';

function build(vinculos: Record<string, string> = {}) {
  const driverIdsForUsers = jest.fn(
    async (_t: string, logins: string[]) =>
      new Map(logins.filter((l) => vinculos[l]).map((l) => [l, vinculos[l]])),
  );
  const fleet: FleetLookupPort = {
    vehicleExists: jest.fn(),
    driverExists: jest.fn(),
    userIdForDriver: jest.fn(),
    driverIdsForUsers,
    activeDriverIds: jest.fn().mockResolvedValue([]),
  };
  return { gateway: new DriverAccountLinkGateway(fleet), driverIdsForUsers };
}

describe('DriverAccountLinkGateway', () => {
  it('traduz login→ficha', async () => {
    const { gateway } = build({ 'login-1': 'ficha-1' });

    const mapa = await gateway.driverIdsForUsers(TENANT, ['login-1']);

    expect(mapa.get('login-1')).toBe('ficha-1');
  });

  // A tradução roda no caminho de escrita mais quente do sistema: uma consulta
  // a `drivers` por ponto de GPS seria custo puro.
  it('não reconsulta o que já está em cache', async () => {
    const { gateway, driverIdsForUsers } = build({ 'login-1': 'ficha-1' });

    await gateway.driverIdsForUsers(TENANT, ['login-1']);
    await gateway.driverIdsForUsers(TENANT, ['login-1']);

    expect(driverIdsForUsers).toHaveBeenCalledTimes(1);
  });

  // Sem cache negativo, o autônomo — que nunca terá ficha — geraria uma
  // consulta a cada posição, justamente o caso mais comum do plano solo.
  it('cacheia também a ausência de ficha', async () => {
    const { gateway, driverIdsForUsers } = build({});

    await gateway.driverIdsForUsers(TENANT, ['login-solo']);
    const segunda = await gateway.driverIdsForUsers(TENANT, ['login-solo']);

    expect(driverIdsForUsers).toHaveBeenCalledTimes(1);
    expect(segunda.size).toBe(0);
  });

  it('consulta apenas os logins que faltam', async () => {
    const { gateway, driverIdsForUsers } = build({
      'login-1': 'ficha-1',
      'login-2': 'ficha-2',
    });

    await gateway.driverIdsForUsers(TENANT, ['login-1']);
    const mapa = await gateway.driverIdsForUsers(TENANT, ['login-1', 'login-2']);

    expect(driverIdsForUsers).toHaveBeenLastCalledWith(TENANT, ['login-2']);
    expect(mapa.get('login-1')).toBe('ficha-1');
    expect(mapa.get('login-2')).toBe('ficha-2');
  });

  // O cache é por tenant: um login de outra organização jamais pode reaproveitar
  // uma entrada — seria vazamento de vínculo entre tenants.
  it('não reaproveita cache entre tenants', async () => {
    const { gateway, driverIdsForUsers } = build({ 'login-1': 'ficha-1' });

    await gateway.driverIdsForUsers(TENANT, ['login-1']);
    await gateway.driverIdsForUsers('outro-tenant', ['login-1']);

    expect(driverIdsForUsers).toHaveBeenCalledTimes(2);
    expect(driverIdsForUsers).toHaveBeenLastCalledWith('outro-tenant', ['login-1']);
  });
});
