import { HaversineRoutingProvider, haversineMatrix } from './haversine-routing.provider';

const points = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 0.1 },
];

describe('haversineMatrix', () => {
  it('matriz simétrica, diagonal 0 e duração derivada da velocidade', () => {
    const { distanceKm, durationMin } = haversineMatrix(points, 60);
    expect(distanceKm[0][0]).toBe(0);
    expect(distanceKm[0][1]).toBeGreaterThan(0);
    expect(distanceKm[0][1]).toBe(distanceKm[1][0]);
    // duração = distância / velocidade * 60
    expect(durationMin[0][1]).toBeCloseTo((distanceKm[0][1] / 60) * 60, 5);
  });
});

describe('HaversineRoutingProvider', () => {
  it('implementa a port de roteamento (async)', async () => {
    const m = await new HaversineRoutingProvider().matrix(points, 30);
    expect(m.distanceKm[0][1]).toBeGreaterThan(0);
    expect(m.durationMin[0][1]).toBeGreaterThan(0);
  });
});
