import { ValidationError } from '../../../shared/kernel/domain-error';

/** Value Object de coordenada geográfica (WGS84). Imutável. */
export class GeoPoint {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {}

  static create(latitude: number, longitude: number): GeoPoint {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new ValidationError('Latitude fora da faixa [-90, 90].');
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new ValidationError('Longitude fora da faixa [-180, 180].');
    }
    return new GeoPoint(latitude, longitude);
  }
}
