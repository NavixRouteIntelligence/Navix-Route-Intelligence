import { NotFoundError } from '../../../shared/kernel/domain-error';
import type { FleetGatewayPort } from './ports/fleet-gateway.port';

export interface AssociationRefs {
  driverId?: string | null;
  vehicleId?: string | null;
}

/**
 * Valida a existência das associações opcionais (motorista/veículo) no contexto
 * Fleet, via a porta anti-corrupção. `routeId` fica como referência opaca até o
 * módulo Routing existir. Só valida quando o valor é informado (não-nulo).
 */
export async function assertAssociationsExist(
  fleet: FleetGatewayPort,
  tenantId: string,
  refs: AssociationRefs,
): Promise<void> {
  if (refs.vehicleId != null && !(await fleet.vehicleExists(tenantId, refs.vehicleId))) {
    throw new NotFoundError('Veículo associado não encontrado.');
  }
  if (refs.driverId != null && !(await fleet.driverExists(tenantId, refs.driverId))) {
    throw new NotFoundError('Motorista associado não encontrado.');
  }
}
