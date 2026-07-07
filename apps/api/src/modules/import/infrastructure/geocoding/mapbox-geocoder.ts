import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type { GeocoderPort, GeocodeResult } from '../../domain/ports/geocoder.port';

interface MapboxContext {
  id: string;
  text: string;
  short_code?: string;
}
interface MapboxFeature {
  center: [number, number];
  text?: string;
  address?: string;
  context?: MapboxContext[];
}

/**
 * Geocoder via Mapbox (server-side). Requer MAPBOX_TOKEN; sem token, retorna
 * nulo (a linha sem coordenadas será marcada como inválida). Troca por outro
 * provedor sem afetar o resto (porta GeocoderPort).
 */
@Injectable()
export class MapboxGeocoder implements GeocoderPort {
  private readonly logger = new Logger(MapboxGeocoder.name);

  constructor(private readonly config: AppConfigService) {}

  async geocode(address: string): Promise<GeocodeResult | null> {
    const token = this.config.mapboxToken;
    if (!token) {
      this.logger.warn('MAPBOX_TOKEN ausente — geocodificação desativada.');
      return null;
    }
    if (!address.trim()) return null;

    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
      `?access_token=${token}&limit=1&language=pt`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Mapbox respondeu ${res.status}: ${body.slice(0, 200)}`);
        return null;
      }
      const data = (await res.json()) as { features?: MapboxFeature[] };
      const feature = data.features?.[0];
      if (!feature) {
        this.logger.warn(`Mapbox sem resultados para: ${address}`);
        return null;
      }

      const [longitude, latitude] = feature.center;
      const ctx = feature.context ?? [];
      const find = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix));

      return {
        latitude,
        longitude,
        street: feature.text,
        number: feature.address,
        city: find('place')?.text,
        state: find('region')?.short_code?.replace(/^BR-/, '') ?? find('region')?.text,
        postalCode: find('postcode')?.text,
        country: find('country')?.short_code?.toUpperCase(),
      };
    } catch (error) {
      this.logger.warn(`Falha na geocodificação: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }
}
