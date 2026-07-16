import type { ProofOfDeliveryView } from '@navix/contracts';

import type { StoragePort } from '../../../shared/storage/storage.port';
import type { ProofOfDelivery } from '../domain/proof-of-delivery';

/**
 * Monta a view do POD. `photo`/`signature` no agregado são **referências**
 * (storage keys, ADR-0046); os valores expostos são URLs **assinadas** resolvidas
 * no *read* (default: os próprios valores, para casos sem storage).
 */
export function toPodView(
  pod: ProofOfDelivery,
  photo: string | null = pod.photo,
  signature: string | null = pod.signature,
): ProofOfDeliveryView {
  return {
    id: pod.id,
    deliveryId: pod.deliveryId,
    driverId: pod.driverId,
    status: pod.status,
    note: pod.note,
    latitude: pod.latitude,
    longitude: pod.longitude,
    photo,
    signature,
    recordedAt: pod.recordedAt.toISOString(),
  };
}

/** Resolve as referências de mídia em URLs assinadas e monta a view (ADR-0046). */
export async function toPodViewSigned(
  pod: ProofOfDelivery,
  storage: StoragePort,
): Promise<ProofOfDeliveryView> {
  const photo = pod.photo ? await storage.readUrl(pod.photo) : null;
  const signature = pod.signature ? await storage.readUrl(pod.signature) : null;
  return toPodView(pod, photo, signature);
}
