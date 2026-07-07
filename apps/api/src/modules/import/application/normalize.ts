import type { DeliveryPriority } from '@navix/contracts';

import type { GeocodeResult } from '../domain/ports/geocoder.port';
import type { ResolvedAddress } from '../domain/import-row';

export function normalizePriority(raw?: string): DeliveryPriority {
  const t = (raw ?? '').toLowerCase().trim();
  if (/urg/.test(t)) return 'urgent';
  if (/alta|high/.test(t)) return 'high';
  if (/baix|low/.test(t)) return 'low';
  return 'normal';
}

/** Monta o endereço estruturado a partir da geocodificação ou do texto bruto. */
export function resolveAddress(addressText: string, geocode: GeocodeResult | null): ResolvedAddress {
  return {
    street: geocode?.street || addressText || '—',
    number: geocode?.number || 'S/N',
    complement: null,
    city: geocode?.city || '—',
    state: geocode?.state || '—',
    postalCode: geocode?.postalCode || '00000',
    country: geocode?.country || 'BR',
  };
}
