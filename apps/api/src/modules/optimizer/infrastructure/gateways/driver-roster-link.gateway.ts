import { Inject, Injectable } from '@nestjs/common';

import {
  FLEET_LOOKUP,
  type FleetLookupPort,
} from '../../../fleet/application/fleet-lookup.service';
import type { DriverRosterLinkPort } from '../../application/ports/driver-roster-link.port';

/**
 * Adaptador anti-corrupção do Optimizer para o Fleet (ADR-0098). Fala com a API
 * pública do Fleet (`FLEET_LOOKUP`), nunca com o repositório de fichas.
 *
 * Sem cache, ao contrário do gateway equivalente do Tracking: aqui a tradução
 * acontece uma vez por otimização e uma vez por abertura da tela de rota, não a
 * cada ponto de GPS.
 */
@Injectable()
export class DriverRosterLinkGateway implements DriverRosterLinkPort {
  constructor(@Inject(FLEET_LOOKUP) private readonly fleet: FleetLookupPort) {}

  async driverIdForUser(tenantId: string, userId: string): Promise<string | null> {
    const fichas = await this.fleet.driverIdsForUsers(tenantId, [userId]);
    return fichas.get(userId) ?? null;
  }

  activeDriverIds(tenantId: string): Promise<string[]> {
    return this.fleet.activeDriverIds(tenantId);
  }
}
