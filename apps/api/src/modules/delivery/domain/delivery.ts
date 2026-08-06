import {
  DELIVERY_PRIORITIES,
  type AddressInput,
  type DeliveryPriority,
  type DeliveryStatus,
  type TimeWindowInput,
} from '@navix/contracts';

import { ConflictError, ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import { canTransition, isTerminal } from './delivery-status';
import { Address } from './value-objects/address';
import { TimeWindow } from './value-objects/time-window';

const MAX_NOTES = 2000;
const MAX_RECIPIENT = 200;
const MAX_CONTACT = 320; // limite prático de um endereço de e-mail (RFC 5321)

/**
 * Validação deliberadamente frouxa: o objetivo é descartar lixo evidente vindo
 * de planilha, não bancar árbitro de RFC. Um endereço que passe daqui e não
 * exista simplesmente não entrega — e o envio registra a falha.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export interface DeliveryProps {
  id: string;
  tenantId: string;
  address: Address;
  priority: DeliveryPriority;
  timeWindow: TimeWindow;
  status: DeliveryStatus;
  driverId: string | null;
  vehicleId: string | null;
  /** Peso da carga (kg). `null` quando não informado (ADR-0109). */
  weightKg: number | null;
  /** Volume ocupado (m³). `null` quando não informado (ADR-0109). */
  volumeM3: number | null;
  routeId: string | null;
  notes: string | null;
  /** Quem recebe. Nulo quando a origem não informou (ADR-0076). */
  recipient: string | null;
  /**
   * Contato do destinatário para as notificações de acompanhamento (ADR-0084).
   * São dados pessoais de terceiros: opcionais, e nunca expostos na página
   * pública de rastreio.
   */
  recipientEmail: string | null;
  recipientPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateDeliveryInput {
  tenantId: string;
  address: AddressInput;
  priority?: DeliveryPriority;
  timeWindow: TimeWindowInput;
  driverId?: string | null;
  vehicleId?: string | null;
  weightKg?: number | null;
  volumeM3?: number | null;
  routeId?: string | null;
  notes?: string | null;
  recipient?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}

export interface UpdateDeliveryInput {
  address?: AddressInput;
  priority?: DeliveryPriority;
  timeWindow?: TimeWindowInput;
  driverId?: string | null;
  vehicleId?: string | null;
  weightKg?: number | null;
  volumeM3?: number | null;
  routeId?: string | null;
  notes?: string | null;
  recipient?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}

/**
 * Aggregate root Delivery. Concentra as invariantes e a máquina de estados.
 * Entregas nascem em 'pending'; associações (driver/vehicle/route) são validadas
 * quanto à existência na camada de aplicação (porta anti-corrupção do Fleet).
 */
export class Delivery {
  private constructor(private props: DeliveryProps) {}

  static create(input: CreateDeliveryInput): Delivery {
    const now = new Date();
    return new Delivery({
      id: newId(),
      tenantId: input.tenantId,
      address: Address.create(input.address),
      priority: Delivery.validatePriority(input.priority ?? 'normal'),
      timeWindow: TimeWindow.create(input.timeWindow),
      status: 'pending',
      driverId: input.driverId ?? null,
      vehicleId: input.vehicleId ?? null,
      weightKg: Delivery.validateDemand(input.weightKg ?? null, 'peso', 'kg'),
      volumeM3: Delivery.validateDemand(input.volumeM3 ?? null, 'volume', 'm³'),
      routeId: input.routeId ?? null,
      notes: Delivery.normalizeNotes(input.notes ?? null),
      recipient: Delivery.normalizeRecipient(input.recipient ?? null),
      recipientEmail: Delivery.normalizeEmail(input.recipientEmail ?? null),
      recipientPhone: Delivery.normalizeContact(input.recipientPhone ?? null),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static restore(props: DeliveryProps): Delivery {
    return new Delivery(props);
  }

  update(input: UpdateDeliveryInput): void {
    this.assertMutable();
    if (input.address !== undefined) this.props.address = Address.create(input.address);
    if (input.timeWindow !== undefined) this.props.timeWindow = TimeWindow.create(input.timeWindow);
    if (input.priority !== undefined) this.props.priority = Delivery.validatePriority(input.priority);
    if (input.notes !== undefined) this.props.notes = Delivery.normalizeNotes(input.notes);
    if (input.recipient !== undefined) this.props.recipient = Delivery.normalizeRecipient(input.recipient);
    if (input.recipientEmail !== undefined) {
      this.props.recipientEmail = Delivery.normalizeEmail(input.recipientEmail);
    }
    if (input.recipientPhone !== undefined) {
      this.props.recipientPhone = Delivery.normalizeContact(input.recipientPhone);
    }
    if (input.driverId !== undefined) this.props.driverId = input.driverId;
    if (input.vehicleId !== undefined) this.props.vehicleId = input.vehicleId;
    if (input.weightKg !== undefined) {
      this.props.weightKg = Delivery.validateDemand(input.weightKg, 'peso', 'kg');
    }
    if (input.volumeM3 !== undefined) {
      this.props.volumeM3 = Delivery.validateDemand(input.volumeM3, 'volume', 'm³');
    }
    if (input.routeId !== undefined) this.props.routeId = input.routeId;
    this.touch();
  }

  changeStatus(to: DeliveryStatus): void {
    if (this.props.deletedAt) {
      throw new ConflictError('Entrega excluída não pode mudar de status.');
    }
    if (!canTransition(this.props.status, to)) {
      throw new ConflictError(
        `Transição de status inválida: ${this.props.status} → ${to}.`,
      );
    }
    this.props.status = to;
    this.touch();
  }

  softDelete(): void {
    if (this.props.deletedAt) return;
    this.props.deletedAt = new Date();
    this.touch();
  }

  snapshot(): Readonly<DeliveryProps> {
    return { ...this.props };
  }

  get status(): DeliveryStatus {
    return this.props.status;
  }

  private assertMutable(): void {
    if (this.props.deletedAt) {
      throw new ConflictError('Entrega excluída não pode ser alterada.');
    }
    if (isTerminal(this.props.status)) {
      throw new ConflictError('Entrega em estado terminal não pode ser alterada.');
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static validatePriority(priority: DeliveryPriority): DeliveryPriority {
    if (!DELIVERY_PRIORITIES.includes(priority)) {
      throw new ValidationError(`Prioridade inválida: ${priority}.`);
    }
    return priority;
  }

  /** Apara e limita; vazio vira nulo (não guarda string em branco). */
  private static normalizeRecipient(recipient: string | null): string | null {
    if (recipient === null) return null;
    const value = recipient.trim();
    if (value.length === 0) return null;
    return value.length > MAX_RECIPIENT ? value.slice(0, MAX_RECIPIENT) : value;
  }

  /** Apara, limita e descarta em branco — comum a e-mail e telefone. */
  private static normalizeContact(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return trimmed.length > MAX_CONTACT ? trimmed.slice(0, MAX_CONTACT) : trimmed;
  }

  /**
   * E-mail em minúsculas. Endereço claramente inválido vira `null` em vez de
   * lançar: uma planilha com uma célula suja não pode abortar a importação
   * inteira — a entrega é criada, só não recebe notificação.
   */
  private static normalizeEmail(email: string | null): string | null {
    const value = Delivery.normalizeContact(email);
    if (value === null) return null;
    const lower = value.toLowerCase();
    return EMAIL_RE.test(lower) ? lower : null;
  }

  /**
   * Peso e volume, quando informados, têm de ser positivos e finitos (ADR-0109).
   *
   * `null` passa: ausência é estado legítimo, e a política de ausência é do
   * otimizador, não do agregado. Zero **não** passa — uma entrega de zero quilo
   * seria indistinguível de "não sei", e é justamente essa confusão que faz a
   * capacidade parecer verificada sem ter sido.
   */
  private static validateDemand(
    value: number | null,
    campo: string,
    unidade: string,
  ): number | null {
    if (value === null) return null;
    if (!Number.isFinite(value) || value <= 0) {
      throw new ValidationError(`O ${campo} da entrega deve ser positivo (${unidade}).`);
    }
    return value;
  }

  private static normalizeNotes(notes: string | null): string | null {
    if (notes === null) return null;
    const value = notes.trim();
    if (value.length === 0) return null;
    if (value.length > MAX_NOTES) {
      throw new ValidationError(`Observações excedem ${MAX_NOTES} caracteres.`);
    }
    return value;
  }
}
