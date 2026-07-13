import { ValidationError } from '../../../shared/kernel/domain-error';
import type { DriverPosition } from '../domain/driver-position';
import type { PositionRepositoryPort } from '../domain/ports/position-repository.port';
import type { TrackingEventsPort } from '../domain/ports/tracking-events.port';
import { BatchUpdatePositionsUseCase } from './batch-update-positions.use-case';

function build() {
  const savedBatches: DriverPosition[][] = [];
  const repo: PositionRepositoryPort = {
    save: jest.fn(),
    saveMany: async (ps) => void savedBatches.push(ps),
    findLatestForDriver: async () => null,
    findLatestPerDriver: async () => [],
    findHistory: async () => [],
  };
  const events: TrackingEventsPort & { positionUpdated: jest.Mock } = {
    positionUpdated: jest.fn(),
  };
  return { uc: new BatchUpdatePositionsUseCase(repo, events), savedBatches, events };
}

const cmd = (positions: { latitude: number; longitude: number }[]) => ({
  tenantId: 't1',
  driverId: 'u1',
  positions,
});

describe('BatchUpdatePositionsUseCase', () => {
  it('grava todas em um único saveMany e publica cada uma em tempo real', async () => {
    const { uc, savedBatches, events } = build();
    const views = await uc.execute(
      cmd([
        { latitude: -23.55, longitude: -46.63 },
        { latitude: -23.56, longitude: -46.64 },
        { latitude: -23.57, longitude: -46.65 },
      ]),
    );

    expect(views).toHaveLength(3);
    // Um único INSERT em lote (não N).
    expect(savedBatches).toHaveLength(1);
    expect(savedBatches[0]).toHaveLength(3);
    expect(savedBatches[0][0].driverId).toBe('u1');
    expect(events.positionUpdated).toHaveBeenCalledTimes(3);
  });

  it('rejeita o lote se qualquer posição tiver coordenadas inválidas', async () => {
    const { uc, savedBatches } = build();
    await expect(
      uc.execute(cmd([{ latitude: -23.55, longitude: -46.63 }, { latitude: 200, longitude: 0 }])),
    ).rejects.toBeInstanceOf(ValidationError);
    // Nada é gravado se a validação falha (a construção ocorre antes do saveMany).
    expect(savedBatches).toHaveLength(0);
  });

  it('rejeita lote vazio', async () => {
    const { uc } = build();
    await expect(uc.execute(cmd([]))).rejects.toBeInstanceOf(ValidationError);
  });
});
