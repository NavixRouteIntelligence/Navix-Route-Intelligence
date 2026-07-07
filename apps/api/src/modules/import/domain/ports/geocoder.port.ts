export interface GeocodeResult {
  latitude: number;
  longitude: number;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/** Resolve um endereço textual em coordenadas + componentes. */
export interface GeocoderPort {
  geocode(address: string): Promise<GeocodeResult | null>;
}

export const GEOCODER = Symbol('GEOCODER');
