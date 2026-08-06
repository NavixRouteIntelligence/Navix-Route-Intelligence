import type { Vehicle as VehicleView } from '@navix/contracts';

import type { Vehicle } from '../../domain/vehicle';

/** Converte a entidade de domínio na representação pública (contrato). */
export function toVehicleView(vehicle: Vehicle): VehicleView {
  const s = vehicle.snapshot();
  return {
    id: s.id,
    tenantId: s.tenantId,
    plate: s.plate,
    type: s.type,
    capacity: s.capacity,
    capacityKg: s.capacityKg,
    capacityVolumeM3: s.capacityVolumeM3,
    status: s.status,
    odometerKm: s.odometerKm,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
