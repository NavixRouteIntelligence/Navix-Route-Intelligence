import { Injectable } from '@nestjs/common';

import type { DriverProfile } from '../domain/driver-profile';
import type { DriverProfileSourcePort } from '../domain/driver-profile-source.port';

/**
 * Adaptador padrão sem histórico (ADR-0025): retorna `null` → o caso de uso cai
 * no override do request ou no perfil neutro. Um adaptador real (agregando
 * `driver_positions`/POD, e depois um modelo de ML por motorista) substitui este
 * pela mesma port, sem tocar o caso de uso.
 */
@Injectable()
export class NoHistoryDriverProfileSource implements DriverProfileSourcePort {
  async get(_tenantId: string, _driverId: string): Promise<DriverProfile | null> {
    return null;
  }
}
