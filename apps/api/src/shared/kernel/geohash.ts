const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Geohash determinístico sem dependência externa. Precisão 9 ≈ célula de poucos metros. */
export function geohash(latitude: number, longitude: number, precision = 9): string {
  const lat: [number, number] = [-90, 90];
  const lng: [number, number] = [-180, 180];
  let even = true;
  let bit = 0;
  let value = 0;
  let out = '';

  while (out.length < precision) {
    const range = even ? lng : lat;
    const coordinate = even ? longitude : latitude;
    const mid = (range[0] + range[1]) / 2;
    if (coordinate >= mid) {
      value = (value << 1) | 1;
      range[0] = mid;
    } else {
      value <<= 1;
      range[1] = mid;
    }
    even = !even;
    bit += 1;
    if (bit === 5) {
      out += BASE32[value];
      bit = 0;
      value = 0;
    }
  }
  return out;
}
