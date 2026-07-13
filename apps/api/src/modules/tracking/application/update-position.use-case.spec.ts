import { ValidationError } from '../../../shared/kernel/domain-error';
import type { DriverPosition } from '../domain/driver-position';
import type { PositionRepositoryPort } from '../domain/ports/position-repository.port';
import type { TrackingEventsPort } from '../domain/ports/tracking-events.port';
import { UpdatePositionUseCase } from './update-position.use-case';

function build() {
  const saved: DriverPosition[] = [];
  const repo: PositionRepositoryPort = {
    save: async (p) => void saved.push(p),
    saveMany: async (ps) => void saved.push(...ps),
    findLatestForDriver: async () => null,
    findLatestPerDriver: async () => [],
    findHistory: async () => [],
  };
  const events: TrackingEventsPort & { positionUpdated: jest.Mock } = {
    positionUpdated: jest.fn(),
  };
  return { uc: new UpdatePositionUseCase(repo, events), saved, events };
}

const base = { tenantId: 't1', driverId: 'u1', latitude: -23.55, longitude: -46.63 };

describe('UpdatePositionUseCase', () => {
  it('persiste a posição, publica em tempo real e retorna a view (en_route padrão)', async () => {
    const { uc, saved, events } = build();
    const view = await uc.execute({ ...base, speed: 40, heading: 90 });
    expect(saved).toHaveLength(1);
    expect(saved[0].driverId).toBe('u1');
    expect(view.status).toBe('en_route');
    expect(view.speed).toBe(40);
    expect(events.positionUpdated).toHaveBeenCalledWith('t1', view);
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
