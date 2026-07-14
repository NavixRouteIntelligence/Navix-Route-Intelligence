import type { DriverProfile } from './driver-profile';

/**
 * Fonte do perfil aprendido de um motorista (ADR-0025). Port desacoplada: o
 * adaptador padrão não tem histórico (retorna `null` → cai no override/neutro);
 * um adaptador real agregaria `driver_positions`/POD, e no futuro serviria um
 * modelo de ML por motorista — sem tocar o caso de uso.
 */
export interface DriverProfileSourcePort {
  get(tenantId: string, driverId: string): Promise<DriverProfile | null>;
}

export const DRIVER_PROFILE_SOURCE = Symbol('DRIVER_PROFILE_SOURCE');
