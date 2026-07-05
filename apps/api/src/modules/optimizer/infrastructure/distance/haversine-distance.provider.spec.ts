import { GeoPoint } from '../../domain/geo-point';
import { HaversineDistanceProvider } from './haversine-distance.provider';

describe('HaversineDistanceProvider', () => {
  const provider = new HaversineDistanceProvider();

  it('distância de um ponto a ele mesmo é 0', () => {
    const p = GeoPoint.create(-23.5, -46.6);
    expect(provider.distanceKm(p, p)).toBe(0);
  });

  it('aproxima uma distância conhecida (SP↔RJ ~ 360km)', () => {
    const sp = GeoPoint.create(-23.5505, -46.6333);
    const rj = GeoPoint.create(-22.9068, -43.1729);
    const d = provider.distanceKm(sp, rj);
    expect(d).toBeGreaterThan(320);
    expect(d).toBeLessThan(380);
  });

  it('é simétrica', () => {
    const a = GeoPoint.create(0, 0);
    const b = GeoPoint.create(10, 10);
    expect(provider.distanceKm(a, b)).toBeCloseTo(provider.distanceKm(b, a), 6);
  });
});
