import type { MaintenanceRecord as MaintenanceView } from '@navix/contracts';

import type { MaintenanceRecord } from '../../domain/maintenance-record';

/** Data (UTC) → ISO date 'YYYY-MM-DD'. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Converte a entidade de domínio na representação pública (cents → euros). */
export function toMaintenanceView(record: MaintenanceRecord): MaintenanceView {
  const s = record.snapshot();
  return {
    id: s.id,
    tenantId: s.tenantId,
    vehicleId: s.vehicleId,
    type: s.type,
    performedAt: isoDate(s.performedAt),
    odometerKm: s.odometerKm,
    cost: s.costCents === null ? null : Math.round(s.costCents) / 100,
    notes: s.notes,
    nextDueDate: s.nextDueDate ? isoDate(s.nextDueDate) : null,
    nextDueOdometerKm: s.nextDueOdometerKm,
    createdAt: s.createdAt.toISOString(),
  };
}
