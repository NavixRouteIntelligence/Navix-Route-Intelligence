import {
  FINANCIAL_CATEGORIES,
  type FinancialCategory,
  type FinancialEntryType,
} from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';

export interface FinancialEntryProps {
  id: string;
  tenantId: string;
  type: FinancialEntryType;
  category: FinancialCategory;
  /** Valor em centavos (inteiro não-negativo). */
  amountCents: number;
  occurredAt: Date;
  odometerKm: number | null;
  liters: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface CreateFinancialEntryInput {
  tenantId: string;
  type: FinancialEntryType;
  category: FinancialCategory;
  amountCents: number;
  occurredAt: Date;
  odometerKm?: number | null;
  liters?: number | null;
  notes?: string | null;
}

/** Entrada do ledger financeiro (FASE 3, F1). Invariantes fora de framework/banco. */
export class FinancialEntry {
  private constructor(private props: FinancialEntryProps) {}

  static create(input: CreateFinancialEntryInput): FinancialEntry {
    return new FinancialEntry({
      id: newId(),
      tenantId: input.tenantId,
      type: FinancialEntry.validateType(input.type),
      category: FinancialEntry.validateCategory(input.category),
      amountCents: FinancialEntry.validateCents(input.amountCents),
      occurredAt: FinancialEntry.validateDate(input.occurredAt),
      odometerKm: FinancialEntry.validateInt(input.odometerKm ?? null, 'Hodômetro'),
      liters: FinancialEntry.validateLiters(input.liters ?? null),
      notes: FinancialEntry.normalizeNotes(input.notes ?? null),
      createdAt: new Date(),
    });
  }

  static restore(props: FinancialEntryProps): FinancialEntry {
    return new FinancialEntry(props);
  }

  snapshot(): Readonly<FinancialEntryProps> {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  private static validateType(type: FinancialEntryType): FinancialEntryType {
    if (type !== 'income' && type !== 'expense') {
      throw new ValidationError(`Tipo financeiro inválido: ${type}.`);
    }
    return type;
  }

  private static validateCategory(category: FinancialCategory): FinancialCategory {
    if (!FINANCIAL_CATEGORIES.includes(category)) {
      throw new ValidationError(`Categoria financeira inválida: ${category}.`);
    }
    return category;
  }

  private static validateCents(cents: number): number {
    if (!Number.isFinite(cents) || cents < 0 || !Number.isInteger(cents)) {
      throw new ValidationError('Valor deve ser não-negativo.');
    }
    return cents;
  }

  private static validateDate(value: Date): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new ValidationError('Data inválida.');
    }
    return value;
  }

  private static validateInt(v: number | null, label: string): number | null {
    if (v === null) return null;
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      throw new ValidationError(`${label} deve ser um inteiro não-negativo.`);
    }
    return v;
  }

  private static validateLiters(v: number | null): number | null {
    if (v === null) return null;
    if (!Number.isFinite(v) || v < 0) throw new ValidationError('Litros deve ser não-negativo.');
    return Math.round(v * 100) / 100;
  }

  private static normalizeNotes(notes: string | null): string | null {
    if (notes === null) return null;
    const value = notes.trim();
    if (value.length === 0) return null;
    if (value.length > 500) throw new ValidationError('Observações: máximo de 500 caracteres.');
    return value;
  }
}
