import {
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type VehicleStatus,
  type VehicleType,
} from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';

export interface VehicleProps {
  id: string;
  tenantId: string;
  plate: string;
  type: VehicleType;
  capacity: number;
  status: VehicleStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleInput {
  tenantId: string;
  plate: string;
  type: VehicleType;
  capacity: number;
  status?: VehicleStatus;
}

export interface UpdateVehicleInput {
  plate?: string;
  type?: VehicleType;
  capacity?: number;
  status?: VehicleStatus;
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
      status: input.status ? Vehicle.validateStatus(input.status) : 'active',
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
    if (input.status !== undefined) this.props.status = Vehicle.validateStatus(input.status);
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
}
