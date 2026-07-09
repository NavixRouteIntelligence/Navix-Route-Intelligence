import type { ProofOfDeliveryView } from '@navix/contracts';

import type { ProofOfDelivery } from '../domain/proof-of-delivery';

export function toPodView(pod: ProofOfDelivery): ProofOfDeliveryView {
  return {
    id: pod.id,
    deliveryId: pod.deliveryId,
    driverId: pod.driverId,
    status: pod.status,
    note: pod.note,
    latitude: pod.latitude,
    longitude: pod.longitude,
    photo: pod.photo,
    signature: pod.signature,
    recordedAt: pod.recordedAt.toISOString(),
  };
}
