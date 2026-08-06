import {
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type VehicleStatus,
  type VehicleType,
} from '@navix/contracts';

import { VEHICLE_CAPACITY_DEFAULTS } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';

export interface VehicleProps {
  id: string;
  tenantId: string;
  plate: string;
  type: VehicleType;
  capacity: number;
  /** Capacidade de peso (kg) — ADR-0109. Null herda o default do tipo. */
  capacityKg: number | null;
  /** Capacidade de volume (m³) — ADR-0109. */
  capacityVolumeM3: number | null;
  status: VehicleStatus;
  odometerKm: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleInput {
  tenantId: string;
  plate: string;
  type: VehicleType;
  capacity: number;
  /** Capacidade de peso (kg). Ausente herda o default do tipo (ADR-0109). */
  capacityKg?: number | null;
  /** Capacidade de volume (m³). Ausente herda o default do tipo. */
  capacityVolumeM3?: number | null;
  status?: VehicleStatus;
  odometerKm?: number | null;
}

export interface UpdateVehicleInput {
  plate?: string;
  type?: VehicleType;
  capacity?: number;
  capacityKg?: number | null;
  capacityVolumeM3?: number | null;
  status?: VehicleStatus;
  odometerKm?: number | null;
}

/**
 * Entidade de domínio Vehicle. Garante as invariantes (placa, tipo, capacidade,
 * status) independentemente de framework ou banco (ver docs/architecture.md §3).
 */
export class Vehicle {
  private constructor(private props: VehicleProps) {}

  static create(input: CreateVehicleInput): Vehicle {
    const now = new Date();
    return new Vehicle({
      id: newId(),
      tenantId: input.tenantId,
      plate: Vehicle.normalizePlate(input.plate),
      type: Vehicle.validateType(input.type),
      capacity: Vehicle.validateCapacity(input.capacity),
      // Sem valor explícito, o default do tipo (ADR-0109): é a melhor
      // informação disponível, e é a mesma que o otimizador já usava.
      capacityKg: Vehicle.validateDimension(
        input.capacityKg ?? VEHICLE_CAPACITY_DEFAULTS[input.type].weightKg,
        'peso',
      ),
      capacityVolumeM3: Vehicle.validateDimension(
        input.capacityVolumeM3 ?? VEHICLE_CAPACITY_DEFAULTS[input.type].volumeM3,
        'volume',
      ),
      status: input.status ? Vehicle.validateStatus(input.status) : 'active',
      odometerKm: Vehicle.validateOdometer(input.odometerKm ?? null),
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Reconstrói a partir da persistência sem revalidar (dados já confiáveis). */
  static restore(props: VehicleProps): Vehicle {
    return new Vehicle(props);
  }

  update(input: UpdateVehicleInput): void {
    if (input.plate !== undefined) this.props.plate = Vehicle.normalizePlate(input.plate);
    if (input.type !== undefined) this.props.type = Vehicle.validateType(input.type);
    if (input.capacity !== undefined)
      this.props.capacity = Vehicle.validateCapacity(input.capacity);
    if (input.capacityKg !== undefined) {
      this.props.capacityKg = Vehicle.validateDimension(input.capacityKg, 'peso');
    }
    if (input.capacityVolumeM3 !== undefined) {
      this.props.capacityVolumeM3 = Vehicle.validateDimension(input.capacityVolumeM3, 'volume');
    }
    if (input.status !== undefined) this.props.status = Vehicle.validateStatus(input.status);
    if (input.odometerKm !== undefined)
      this.props.odometerKm = Vehicle.validateOdometer(input.odometerKm);
    this.props.updatedAt = new Date();
  }

  snapshot(): Readonly<VehicleProps> {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get plate(): string {
    return this.props.plate;
  }

  // ----- invariantes -----

  private static normalizePlate(plate: string): string {
    const value = (plate ?? '').trim().toUpperCase();
    if (value.length < 3 || value.length > 20) {
      throw new ValidationError('Placa deve ter entre 3 e 20 caracteres.');
    }
    return value;
  }

  private static validateType(type: VehicleType): VehicleType {
    if (!VEHICLE_TYPES.includes(type)) {
      throw new ValidationError(`Tipo de veículo inválido: ${type}.`);
    }
    return type;
  }

  /**
   * Capacidade por dimensão (ADR-0109): positiva quando informada.
   *
   * Aceita fracionário, ao contrário de [validateCapacity] — 0,8 m³ é uma
   * capacidade legítima, e exigir inteiro ali foi o que empurrou o campo antigo
   * para uma unidade que ninguém conseguia nomear.
   */
  private static validateDimension(value: number | null, campo: string): number | null {
    if (value === null) return null;
    if (!Number.isFinite(value) || value <= 0) {
      throw new ValidationError(`A capacidade de ${campo} do veículo deve ser positiva.`);
    }
    return value;
  }

  private static validateCapacity(capacity: number): number {
    if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
      throw new ValidationError('Capacidade deve ser um inteiro positivo.');
    }
    return capacity;
  }

  private static validateStatus(status: VehicleStatus): VehicleStatus {
    if (!VEHICLE_STATUSES.includes(status)) {
      throw new ValidationError(`Status de veículo inválido: ${status}.`);
    }
    return status;
  }

  private static validateOdometer(km: number | null): number | null {
    if (km === null) return null;
    if (!Number.isFinite(km) || km < 0 || !Number.isInteger(km)) {
      throw new ValidationError('Hodômetro deve ser um inteiro não-negativo.');
    }
    return km;
  }
}
