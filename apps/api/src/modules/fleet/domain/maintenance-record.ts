import { MAINTENANCE_TYPES, type MaintenanceType } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';

export interface MaintenanceRecordProps {
  id: string;
  tenantId: string;
  vehicleId: string;
  type: MaintenanceType;
  performedAt: Date;
  odometerKm: number | null;
  /** Custo em centavos (inteiro) — evita erro de ponto flutuante. */
  costCents: number | null;
  notes: string | null;
  nextDueDate: Date | null;
  nextDueOdometerKm: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMaintenanceRecordInput {
  tenantId: string;
  vehicleId: string;
  type: MaintenanceType;
  performedAt: Date;
  odometerKm?: number | null;
  costCents?: number | null;
  notes?: string | null;
  nextDueDate?: Date | null;
  nextDueOdometerKm?: number | null;
}

/**
 * Registro de manutenção de um veículo (FASE 3, V1). Garante as invariantes
 * (tipo válido, datas coerentes, valores não-negativos) fora de framework/banco.
 */
export class MaintenanceRecord {
  private constructor(private props: MaintenanceRecordProps) {}

  static create(input: CreateMaintenanceRecordInput): MaintenanceRecord {
    const now = new Date();
    return new MaintenanceRecord({
      id: newId(),
      tenantId: input.tenantId,
      vehicleId: input.vehicleId,
      type: MaintenanceRecord.validateType(input.type),
      performedAt: MaintenanceRecord.validateDate(input.performedAt, 'Data da manutenção'),
      odometerKm: MaintenanceRecord.validateKm(input.odometerKm ?? null, 'Hodômetro'),
      costCents: MaintenanceRecord.validateCents(input.costCents ?? null),
      notes: MaintenanceRecord.normalizeNotes(input.notes ?? null),
      nextDueDate: input.nextDueDate ? MaintenanceRecord.validateDate(input.nextDueDate, 'Próximo vencimento') : null,
      nextDueOdometerKm: MaintenanceRecord.validateKm(input.nextDueOdometerKm ?? null, 'Vencimento por km'),
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: MaintenanceRecordProps): MaintenanceRecord {
    return new MaintenanceRecord(props);
  }

  snapshot(): Readonly<MaintenanceRecordProps> {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  // ----- invariantes -----

  private static validateType(type: MaintenanceType): MaintenanceType {
    if (!MAINTENANCE_TYPES.includes(type)) {
      throw new ValidationError(`Tipo de manutenção inválido: ${type}.`);
    }
    return type;
  }

  private static validateDate(value: Date, label: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new ValidationError(`${label} inválida.`);
    }
    return value;
  }

  private static validateKm(km: number | null, label: string): number | null {
    if (km === null) return null;
    if (!Number.isFinite(km) || km < 0 || !Number.isInteger(km)) {
      throw new ValidationError(`${label} deve ser um inteiro não-negativo.`);
    }
    return km;
  }

  private static validateCents(cents: number | null): number | null {
    if (cents === null) return null;
    if (!Number.isFinite(cents) || cents < 0 || !Number.isInteger(cents)) {
      throw new ValidationError('Custo deve ser um valor não-negativo.');
    }
    return cents;
  }

  private static normalizeNotes(notes: string | null): string | null {
    if (notes === null) return null;
    const value = notes.trim();
    if (value.length === 0) return null;
    if (value.length > 500) throw new ValidationError('Observações: máximo de 500 caracteres.');
    return value;
  }
}
