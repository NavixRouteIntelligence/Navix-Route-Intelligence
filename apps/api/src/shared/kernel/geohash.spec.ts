import { geohash } from './geohash';

describe('geohash', () => {
  it('é determinístico e separa regiões', () => {
    expect(geohash(38.7223, -9.1393)).toBe(geohash(38.7223, -9.1393));
    expect(geohash(38.7223, -9.1393, 5)).not.toBe(geohash(41.1579, -8.6291, 5));
  });

  it('mantém pontos próximos na mesma célula operacional', () => {
    expect(geohash(38.7223, -9.1393, 6)).toBe(geohash(38.7224, -9.1392, 6));
  });
});
