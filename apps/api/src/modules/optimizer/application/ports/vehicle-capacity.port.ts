import type { VehicleType } from '@navix/contracts';

/**
 * Capacidade do veículo **atribuído** (ADR-0109).
 *
 * Antes o otimizador só conhecia os defaults por tipo, então dois furgões da
 * mesma frota eram indistinguíveis — e a capacidade "do veículo" era, na
 * verdade, a capacidade típica da categoria dele.
 *
 * Port própria e estreita, ao lado da `DRIVER_ROSTER_LINK`: as duas adaptam a
 * API pública do Fleet, mas respondem perguntas diferentes, e juntá-las
 * obrigaria quem usa uma a conhecer a outra.
 */
export interface VehicleCapacityPort {
  /** `null` quando o veículo não existe no tenant. */
  capacityOf(
    tenantId: string,
    vehicleId: string,
  ): Promise<{ type: VehicleType; weightKg: number | null; volumeM3: number | null } | null>;
}

export const VEHICLE_CAPACITY = Symbol('VEHICLE_CAPACITY');
