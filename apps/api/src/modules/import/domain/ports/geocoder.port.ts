import type { GeocodeAccuracy, GeocodeConfidence } from '../geocode-quality';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  /**
   * Quão bem a morada casou (ADR-0133).
   *
   * `'unknown'` em resultados vindos de um provedor que não o diga — e
   * `'unknown'` conta como fraco: um provedor que não sabe dizer a confiança
   * não é motivo para confiar.
   */
  confidence: GeocodeConfidence;

  /** Como a coordenada foi obtida — o edifício, a rua, ou o centro da cidade. */
  accuracy: GeocodeAccuracy;

  /**
   * O resultado não é bom o suficiente para virar parada sem alguém olhar.
   *
   * Decidido no adaptador, e não em quem consome: a regra depende do
   * vocabulário do provedor, e espalhá-la faria cada consumidor inventar o seu
   * próprio limiar.
   */
  needsReview: boolean;

  /** Por que precisa de revisão, para a tela poder explicar-se. `null` quando não precisa. */
  reviewReason: string | null;
}

/** País e idioma a pedir ao provedor. Ausente significa sem filtro. */
export interface GeocodeOptions {
  /** ISO 3166-1 alpha-2, minúsculo. */
  country?: string;
  language?: string;
}

/**
 * Resolve um endereço textual em coordenadas + componentes.
 *
 * O port não mudou de forma: [GeocodeOptions] é opcional, e um adaptador que a
 * ignore continua a cumprir o contrato. O que mudou foi o **resultado**, que
 * passou a carregar a qualidade — sem ela, quem consome não tem como
 * distinguir uma porta de um centro de cidade.
 */
export interface GeocoderPort {
  geocode(address: string, options?: GeocodeOptions): Promise<GeocodeResult | null>;
}

export const GEOCODER = Symbol('GEOCODER');
