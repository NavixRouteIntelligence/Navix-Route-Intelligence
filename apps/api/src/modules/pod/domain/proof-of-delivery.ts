import type { PodStatus } from '@navix/contracts';

/** Comprovante de entrega (sem dependências de framework/ORM). */
export interface ProofOfDelivery {
  id: string;
  tenantId: string;
  deliveryId: string;
  driverId: string;
  status: PodStatus;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  photo: string | null;
  signature: string | null;
  recordedAt: Date;
}

/** Desfecho do POD → status resultante da entrega (máquina de estados do Delivery). */
export function outcomeToDeliveryStatus(status: PodStatus): 'delivered' | 'failed' {
  return status === 'delivered' ? 'delivered' : 'failed';
}
