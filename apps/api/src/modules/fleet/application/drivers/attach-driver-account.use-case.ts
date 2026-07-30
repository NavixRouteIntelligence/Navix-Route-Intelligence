import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../../shared/audit/audit-log.port';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/kernel/domain-error';
import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';
import { Driver } from '../../domain/driver';

export interface AttachDriverAccountCommand {
  tenantId: string;
  /** Login recém-criado, a ligar à ficha. */
  userId: string;
  /** Ficha existente. Ausente → uma ficha nova é criada com `name`/`licenseNumber`. */
  driverId?: string | null;
  name?: string;
  licenseNumber?: string;
}

/**
 * Liga um login à ficha de motorista (ADR-0085) — a ponte que faltava entre os
 * dois conceitos de "motorista" que o sistema mantinha desconectados: a ficha
 * da frota (`drivers`, referenciada por `deliveries.driver_id`) e o usuário
 * (`users`, sob cujo id o app grava as posições).
 *
 * É a **API pública** do Fleet para o módulo de convites: mantém dentro do
 * Fleet as invariantes da ficha (unicidade de CNH, uma conta por ficha) em vez
 * de deixá-las vazarem para quem apenas aceita um convite.
 *
 * Roda sob a RLS do tenant recebido — o chamador já abriu a transação.
 */
@Injectable()
export class AttachDriverAccountUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: AttachDriverAccountCommand): Promise<{ driverId: string }> {
    // Um login pertence a no máximo uma ficha dentro do tenant (índice único
    // parcial). Conferido antes para devolver um 409 explicável em vez do 23505.
    if (await this.drivers.existsByUser(command.tenantId, command.userId)) {
      throw new ConflictError('Esta conta já está vinculada a um motorista.');
    }

    const driver = command.driverId
      ? await this.linkExisting(command)
      : await this.createLinked(command);

    await this.drivers.save(driver);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.userId,
      action: 'fleet.driver.account-linked',
      resource: `driver:${driver.id}`,
      metadata: { userId: command.userId, createdFicha: !command.driverId },
    });
    return { driverId: driver.id };
  }

  private async linkExisting(command: AttachDriverAccountCommand): Promise<Driver> {
    // Leitura sob RLS: uma ficha de outro tenant simplesmente não é encontrada.
    const driver = await this.drivers.findById(command.tenantId, command.driverId as string);
    if (!driver) throw new NotFoundError('Motorista não encontrado.');
    driver.linkAccount(command.userId);
    return driver;
  }

  private async createLinked(command: AttachDriverAccountCommand): Promise<Driver> {
    if (!command.name || !command.licenseNumber) {
      throw new ValidationError('Nome e habilitação são obrigatórios para criar a ficha.');
    }
    const driver = Driver.create({
      tenantId: command.tenantId,
      name: command.name,
      licenseNumber: command.licenseNumber,
      userId: command.userId,
    });
    if (await this.drivers.existsByLicense(command.tenantId, driver.licenseNumber)) {
      throw new ConflictError('Já existe um motorista com esta habilitação.');
    }
    return driver;
  }
}
