import type { Repository } from 'typeorm';

import { DriverInviteRepository } from './driver-invite.repository';
import type { DriverInviteOrmEntity } from './driver-invite.orm-entity';

const LINHA = {
  tenant_id: 'tenant-a',
  organization_name: 'Transportes A',
  email: 'motorista@exemplo.pt',
  driver_id: 'ficha-1',
};

function repoWith(raw: unknown): { repo: DriverInviteRepository } {
  const base = {
    query: jest.fn().mockResolvedValue(raw),
  } as unknown as Repository<DriverInviteOrmEntity>;
  return { repo: new DriverInviteRepository(base) };
}

/**
 * Regressão de um 500 que só apareceu com o Postgres real: o driver devolve
 * formatos diferentes para `SELECT` e para `UPDATE ... RETURNING`, e o segundo
 * (`[linhas, afetadas]`) tem `raw[0]` **array** — truthy, mas sem nenhum campo.
 * O convite era dado por resolvido com `tenantId` indefinido.
 */
describe('DriverInviteRepository — formatos de retorno do driver', () => {
  it('SELECT: lista de linhas', async () => {
    const { repo } = repoWith([LINHA]);

    await expect(repo.resolve('tk')).resolves.toEqual({
      tenantId: 'tenant-a',
      organizationName: 'Transportes A',
      email: 'motorista@exemplo.pt',
      driverId: 'ficha-1',
    });
  });

  it('UPDATE ... RETURNING: [linhas, afetadas]', async () => {
    const { repo } = repoWith([[LINHA], 1]);

    const ref = await repo.claim('tk');

    expect(ref).toMatchObject({ tenantId: 'tenant-a', email: 'motorista@exemplo.pt' });
  });

  it('UPDATE que não casou nada devolve null, e não um objeto vazio', async () => {
    const { repo } = repoWith([[], 0]);

    await expect(repo.claim('tk')).resolves.toBeNull();
  });

  it('SELECT sem resultado devolve null', async () => {
    const { repo } = repoWith([]);

    await expect(repo.resolve('tk')).resolves.toBeNull();
  });
});
