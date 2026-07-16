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
});
