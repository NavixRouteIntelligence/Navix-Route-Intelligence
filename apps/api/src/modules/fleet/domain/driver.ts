import { DRIVER_STATUSES, type DriverStatus } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';

export interface DriverProps {
  id: string;
  tenantId: string;
  name: string;
  licenseNumber: string;
  skills: string[];
  status: DriverStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDriverInput {
  tenantId: string;
  name: string;
  licenseNumber: string;
  skills?: string[];
  status?: DriverStatus;
}

export interface UpdateDriverInput {
  name?: string;
  licenseNumber?: string;
  skills?: string[];
  status?: DriverStatus;
}

/** Entidade de domínio Driver com invariantes de nome, CNH, skills e status. */
export class Driver {
  private constructor(private props: DriverProps) {}

  static create(input: CreateDriverInput): Driver {
    const now = new Date();
    return new Driver({
      id: newId(),
      tenantId: input.tenantId,
      name: Driver.normalizeName(input.name),
      licenseNumber: Driver.normalizeLicense(input.licenseNumber),
      skills: Driver.normalizeSkills(input.skills ?? []),
      status: input.status ? Driver.validateStatus(input.status) : 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: DriverProps): Driver {
    return new Driver(props);
  }

  update(input: UpdateDriverInput): void {
    if (input.name !== undefined) this.props.name = Driver.normalizeName(input.name);
    if (input.licenseNumber !== undefined)
      this.props.licenseNumber = Driver.normalizeLicense(input.licenseNumber);
    if (input.skills !== undefined) this.props.skills = Driver.normalizeSkills(input.skills);
    if (input.status !== undefined) this.props.status = Driver.validateStatus(input.status);
    this.props.updatedAt = new Date();
  }

  snapshot(): Readonly<DriverProps> {
    return { ...this.props, skills: [...this.props.skills] };
  }

  get id(): string {
    return this.props.id;
  }

  get licenseNumber(): string {
    return this.props.licenseNumber;
  }

  // ----- invariantes -----

  private static normalizeName(name: string): string {
    const value = (name ?? '').trim();
    if (value.length < 2 || value.length > 120) {
      throw new ValidationError('Nome deve ter entre 2 e 120 caracteres.');
    }
    return value;
  }

  private static normalizeLicense(license: string): string {
    const value = (license ?? '').trim().toUpperCase();
    if (value.length < 3 || value.length > 40) {
      throw new ValidationError('Número de habilitação inválido.');
    }
    return value;
  }

  private static normalizeSkills(skills: string[]): string[] {
    const cleaned = Array.from(
      new Set(skills.map((s) => (s ?? '').trim().toLowerCase()).filter(Boolean)),
    );
    if (cleaned.some((s) => s.length > 40)) {
      throw new ValidationError('Cada skill deve ter no máximo 40 caracteres.');
    }
    return cleaned;
  }

  private static validateStatus(status: DriverStatus): DriverStatus {
    if (!DRIVER_STATUSES.includes(status)) {
      throw new ValidationError(`Status de motorista inválido: ${status}.`);
    }
    return status;
  }
}
