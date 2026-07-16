import type { TrafficModelPort } from '../domain/traffic-model';
import { locationCell, type CollectiveObservation } from '../domain/collective-insight';
import { InMemoryCollectiveInsights } from './in-memory-collective-insights';
import { CommunityAwareParkingPredictor } from './community-aware-parking-predictor';

const POINT = { latitude: -23.55, longitude: -46.63 };

function observation(difficulty: 'easy' | 'moderate' | 'hard'): CollectiveObservation {
  return {
    id: Math.random().toString(36).slice(2),
    tenantId: 't1',
    driverId: 'd1',
    cell: locationCell(POINT.latitude, POINT.longitude),
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    kind: 'parking',
    parkingDifficulty: difficulty,
    serviceMinutes: null,
    accessTip: null,
    createdAt: new Date(),
  };
}

describe('CommunityAwareParkingPredictor', () => {
  const freeTraffic: TrafficModelPort = { factor: () => 1 }; // heurística → easy

  it('sem observações, degrada para a heurística de trânsito', async () => {
    const predictor = new CommunityAwareParkingPredictor(freeTraffic, new InMemoryCollectiveInsights());
    const view = await predictor.predict({ tenantId: 't1', point: POINT, arrivalAt: new Date() });
    expect(view.difficulty).toBe('easy');
  });

  it('realimenta a previsão com o que a frota observou no local', async () => {
    const store = new InMemoryCollectiveInsights();
    for (const d of ['hard', 'hard', 'hard'] as const) await store.record(observation(d));
    const predictor = new CommunityAwareParkingPredictor(freeTraffic, store);

    const view = await predictor.predict({ tenantId: 't1', point: POINT, arrivalAt: new Date() });
    expect(view.difficulty).toBe('hard');
  });

  it('isola por tenant (observações de outro tenant não influenciam)', async () => {
    const store = new InMemoryCollectiveInsights();
    for (const d of ['hard', 'hard', 'hard'] as const) await store.record(observation(d));
    const predictor = new CommunityAwareParkingPredictor(freeTraffic, store);

    const view = await predictor.predict({ tenantId: 't2', point: POINT, arrivalAt: new Date() });
    expect(view.difficulty).toBe('easy');
  });

  it('predictMany faz UMA consulta em lote e realimenta cada parada (sem N+1)', async () => {
    const store = new InMemoryCollectiveInsights();
    for (const d of ['hard', 'hard', 'hard'] as const) await store.record(observation(d));
    const spy = jest.spyOn(store, 'findRecentByCells');
    const predictor = new CommunityAwareParkingPredictor(freeTraffic, store);

    const other = { latitude: 10, longitude: 10 };
    const result = await predictor.predictMany('t1', [
      { id: 'a', point: POINT, arrivalAt: new Date() },
      { id: 'b', point: POINT, arrivalAt: new Date() },
      { id: 'c', point: other, arrivalAt: new Date() },
    ]);

    // Uma única consulta para todas as paradas (2 células distintas).
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.get('a')?.difficulty).toBe('hard'); // célula com observações
    expect(result.get('b')?.difficulty).toBe('hard');
    expect(result.get('c')?.difficulty).toBe('easy'); // célula sem observações → heurística
  });
});
