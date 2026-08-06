import type { Delivery as DeliveryView } from '@navix/contracts';

import type { Delivery } from '../../domain/delivery';

/** Converte o agregado de domínio na representação pública (contrato). */
export function toDeliveryView(delivery: Delivery): DeliveryView {
  const s = delivery.snapshot();
  return {
    id: s.id,
    tenantId: s.tenantId,
    address: s.address.snapshot(),
    priority: s.priority,
    timeWindow: {
      start: s.timeWindow.start.toISOString(),
      end: s.timeWindow.end.toISOString(),
    },
    status: s.status,
    driverId: s.driverId,
    vehicleId: s.vehicleId,
    weightKg: s.weightKg,
    volumeM3: s.volumeM3,
    routeId: s.routeId,
    notes: s.notes,
    recipient: s.recipient,
    recipientEmail: s.recipientEmail,
    recipientPhone: s.recipientPhone,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    // Tombstone: null em leituras normais; preenchido no feed de sync (ADR-0020).
    deletedAt: s.deletedAt ? s.deletedAt.toISOString() : null,
  };
}
