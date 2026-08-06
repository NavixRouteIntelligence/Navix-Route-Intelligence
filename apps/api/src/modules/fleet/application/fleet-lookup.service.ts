import { Inject, Injectable } from '@nestjs/common';
import type { VehicleType } from '@navix/contracts';

import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
  type RosterDriver,
} from '../domain/ports/driver-repository.port';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../domain/ports/vehicle-repository.port';

/**
 * API pública do contexto Fleet, consumida por outros módulos (ex.: Delivery)
 * através de suas próprias portas anti-corrupção. É o único ponto de entrada
 * externo ao Fleet — internals (entidades, repositórios) permanecem privados.
 */
/** Capacidade declarada de um veículo da frota (ADR-0109). */
export interface VehicleCapacityDto {
  type: VehicleType;
  /** `null` quando o veículo não declara a dimensão. */
  weightKg: number | null;
  volumeM3: number | null;
}

export interface FleetLookupPort {
  vehicleExists(tenantId: string, vehicleId: string): Promise<boolean>;
  /**
   * Capacidade **do veículo**, não do tipo dele (ADR-0109). Dois furgões da
   * mesma frota podem ter capacidades diferentes, e era essa distinção que se
   * perdia quando o otimizador lia só os defaults por tipo.
   */
  vehicleCapacity(tenantId: string, vehicleId: string): Promise<VehicleCapacityDto | null>;
  driverExists(tenantId: string, driverId: string): Promise<boolean>;
  /**
   * Login ligado a uma ficha (ADR-0086). `null` quando a ficha não tem conta no
   * app — é o caso do terceirizado, e nunca deve ser lido como erro.
   */
  userIdForDriver(tenantId: string, driverId: string): Promise<string | null>;
  /**
   * Fichas de um conjunto de logins, numa consulta só. Logins sem ficha
   * (motorista autônomo) simplesmente não aparecem no mapa.
   */
  driverIdsForUsers(tenantId: string, userIds: string[]): Promise<Map<string, string>>;
  /**
   * Fichas **ativas** do tenant (id e nome) — quem está apto a receber entrega
   * numa distribuição e quem aparece no painel dela (ADR-0101). Vazio é
   * resposta legítima: tenant sem frota, ou frota inteira inativa.
   */
  activeDrivers(tenantId: string): Promise<RosterDriver[]>;
}

export const FLEET_LOOKUP = Symbol('FLEET_LOOKUP');

@Injectable()
export class FleetLookupService implements FleetLookupPort {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
  ) {}

  async vehicleExists(tenantId: string, vehicleId: string): Promise<boolean> {
    return (await this.vehicles.findById(tenantId, vehicleId)) !== null;
  }

  async vehicleCapacity(tenantId: string, vehicleId: string): Promise<VehicleCapacityDto | null> {
    const vehicle = await this.vehicles.findById(tenantId, vehicleId);
    if (!vehicle) return null;
    const s = vehicle.snapshot();
    return { type: s.type, weightKg: s.capacityKg, volumeM3: s.capacityVolumeM3 };
  }

  async driverExists(tenantId: string, driverId: string): Promise<boolean> {
    return (await this.drivers.findById(tenantId, driverId)) !== null;
  }

  userIdForDriver(tenantId: string, driverId: string): Promise<string | null> {
    return this.drivers.findUserIdById(tenantId, driverId);
  }

  driverIdsForUsers(tenantId: string, userIds: string[]): Promise<Map<string, string>> {
    return this.drivers.findIdsByUserIds(tenantId, userIds);
  }

  activeDrivers(tenantId: string): Promise<RosterDriver[]> {
    return this.drivers.findActive(tenantId);
  }
}
