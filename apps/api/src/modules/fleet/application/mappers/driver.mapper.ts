import type { Driver as DriverView } from '@navix/contracts';

import type { Driver } from '../../domain/driver';

/** Converte a entidade de domínio na representação pública (contrato). */
export function toDriverView(driver: Driver): DriverView {
  const s = driver.snapshot();
  return {
    id: s.id,
    tenantId: s.tenantId,
    name: s.name,
    licenseNumber: s.licenseNumber,
    skills: s.skills,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
