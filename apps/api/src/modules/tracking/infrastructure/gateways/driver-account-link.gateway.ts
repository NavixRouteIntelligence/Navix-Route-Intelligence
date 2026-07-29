import { Inject, Injectable } from '@nestjs/common';

import { FLEET_LOOKUP, type FleetLookupPort } from '../../../fleet/application/fleet-lookup.service';
import type { DriverAccountLinkPort } from '../../application/ports/driver-account-link.port';

/**
 * Quanto tempo um vínculo ficha↔login fica em cache (ADR-0086).
 *
 * A posição chega a cada poucos segundos por motorista, e a tradução entra no
 * caminho de escrita: sem cache seria uma consulta a `drivers` por ponto de
 * GPS. O vínculo, por outro lado, muda quando alguém aceita um convite —
 * praticamente nunca. Cinco minutos é folgado para o custo e curto o bastante
 * para um motorista recém-convidado aparecer na frota sem reiniciar nada.
 */
const CACHE_TTL_MS = 5 * 60_000;

interface CacheEntry {
  driverId: string | null;
  expiresAt: number;
}

/**
 * Adaptador anti-corrupção do Tracking para o Fleet (ADR-0086). Única ponte
 * entre os dois módulos, e sempre pela API pública do Fleet (`FLEET_LOOKUP`),
 * nunca pelo repositório de fichas.
 */
@Injectable()
export class DriverAccountLinkGateway implements DriverAccountLinkPort {
  /** Só o sentido login→ficha é cacheado: é o que roda no caminho quente. */
  private readonly byUser = new Map<string, CacheEntry>();

  constructor(@Inject(FLEET_LOOKUP) private readonly fleet: FleetLookupPort) {}

  userIdForDriver(tenantId: string, driverId: string): Promise<string | null> {
    return this.fleet.userIdForDriver(tenantId, driverId);
  }

  async driverIdsForUsers(
    tenantId: string,
    userIds: string[],
  ): Promise<Map<string, string>> {
    const now = Date.now();
    const resolved = new Map<string, string>();
    const faltando: string[] = [];

    for (const userId of userIds) {
      const hit = this.byUser.get(`${tenantId}:${userId}`);
      if (hit && hit.expiresAt > now) {
        // Entrada negativa em cache também vale: o autônomo sem ficha não deve
        // gerar consulta a cada posição só por não ter vínculo.
        if (hit.driverId) resolved.set(userId, hit.driverId);
      } else {
        faltando.push(userId);
      }
    }

    if (faltando.length > 0) {
      const fresh = await this.fleet.driverIdsForUsers(tenantId, faltando);
      for (const userId of faltando) {
        const driverId = fresh.get(userId) ?? null;
        this.byUser.set(`${tenantId}:${userId}`, {
          driverId,
          expiresAt: now + CACHE_TTL_MS,
        });
        if (driverId) resolved.set(userId, driverId);
      }
    }

    return resolved;
  }
}
