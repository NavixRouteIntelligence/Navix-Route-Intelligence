import type { CollectiveObservation } from '../domain/collective-insight';
import { locationCell } from '../domain/collective-insight';
import type { CollectiveInsightsPort } from '../domain/collective-insights.port';
import { CollectiveServiceTimeLookup } from './collective-service-time.lookup';

function obs(lat: number, lng: number, minutes: number, id: string): CollectiveObservation {
  return {
    id,
    tenantId: 't1',
    driverId: 'd1',
    cell: locationCell(lat, lng),
    latitude: lat,
    longitude: lng,
    kind: 'service_time',
    parkingDifficulty: null,
    serviceMinutes: minutes,
    accessTip: null,
    createdAt: new Date(),
  };
}

describe('CollectiveServiceTimeLookup (ADR-0065)', () => {
  const A = { latitude: 38.7, longitude: -9.1 };
  const B = { latitude: 41.15, longitude: -8.61 };

  function build(observations: CollectiveObservation[]) {
    const store: CollectiveInsightsPort = {
      record: async () => undefined,
      findRecent: async () => [],
      findRecentByCells: async () => observations,
    };
    return new CollectiveServiceTimeLookup(store);
  }

  it('devolve a mediana por local quando há amostra suficiente (>= 3)', async () => {
    const lookup = build([
      obs(A.latitude, A.longitude, 8, '1'),
      obs(A.latitude, A.longitude, 10, '2'),
      obs(A.latitude, A.longitude, 12, '3'),
    ]);
    const result = await lookup.typicalServiceMinutes('t1', [A]);
    expect(result).toEqual([10]); // mediana de 8,10,12
  });

  it('null quando amostra insuficiente (< 3)', async () => {
    const lookup = build([obs(A.latitude, A.longitude, 8, '1'), obs(A.latitude, A.longitude, 10, '2')]);
    expect(await lookup.typicalServiceMinutes('t1', [A])).toEqual([null]);
  });

  it('mapeia cada ponto ao seu local; pontos sem dado ficam null, na ordem', async () => {
    const lookup = build([
      obs(A.latitude, A.longitude, 5, '1'),
      obs(A.latitude, A.longitude, 5, '2'),
      obs(A.latitude, A.longitude, 5, '3'),
    ]);
    const result = await lookup.typicalServiceMinutes('t1', [B, A]);
    expect(result).toEqual([null, 5]); // B sem dado; A com mediana 5
  });

  it('lista vazia devolve vazio (sem consulta)', async () => {
    const lookup = build([]);
    expect(await lookup.typicalServiceMinutes('t1', [])).toEqual([]);
  });
});
