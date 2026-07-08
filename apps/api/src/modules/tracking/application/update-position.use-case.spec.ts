import { ValidationError } from '../../../shared/kernel/domain-error';
import type { DriverPosition } from '../domain/driver-position';
import type { PositionRepositoryPort } from '../domain/ports/position-repository.port';
import { UpdatePositionUseCase } from './update-position.use-case';

function build() {
  const saved: DriverPosition[] = [];
  const repo: PositionRepositoryPort = {
    save: async (p) => void saved.push(p),
    findLatestForDriver: async () => null,
    findLatestPerDriver: async () => [],
    findHistory: async () => [],
  };
  return { uc: new UpdatePositionUseCase(repo), saved };
}

const base = { tenantId: 't1', driverId: 'u1', latitude: -23.55, longitude: -46.63 };

describe('UpdatePositionUseCase', () => {
  it('persiste a posição e retorna a view com status en_route por padrão', async () => {
    const { uc, saved } = build();
    const view = await uc.execute({ ...base, speed: 40, heading: 90 });
    expect(saved).toHaveLength(1);
    expect(saved[0].driverId).toBe('u1');
    expect(view.status).toBe('en_route');
    expect(view.speed).toBe(40);
  });

  it('aceita status finished reportado', async () => {
    const { uc } = build();
    const view = await uc.execute({ ...base, status: 'finished' });
    expect(view.status).toBe('finished');
  });

  it('rejeita coordenadas inválidas', async () => {
    const { uc } = build();
    await expect(uc.execute({ ...base, latitude: 200 })).rejects.toBeInstanceOf(ValidationError);
  });
});
