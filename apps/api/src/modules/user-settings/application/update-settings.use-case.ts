import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_USER_SETTINGS,
  type UpdateUserSettingsRequest,
  type UserSettings,
} from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ValidationError } from '../../../shared/kernel/domain-error';
import { applyPatch } from '../domain/user-settings';
import {
  USER_SETTINGS_REPOSITORY,
  type UserSettingsRepositoryPort,
} from '../domain/ports/user-settings-repository.port';

export interface UpdateSettingsCommand {
  tenantId: string;
  userId: string;
  patch: UpdateUserSettingsRequest;
}

/**
 * Aplica um patch parcial às preferências do usuário (merge por chave). Cria a
 * linha na primeira escrita (a partir dos defaults). Valores inválidos são
 * ignorados no domínio; o patch vazio é rejeitado para não gerar ruído.
 */
@Injectable()
export class UpdateSettingsUseCase {
  constructor(
    @Inject(USER_SETTINGS_REPOSITORY)
    private readonly repo: UserSettingsRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: UpdateSettingsCommand): Promise<UserSettings> {
    const keys = Object.keys(command.patch ?? {});
    if (keys.length === 0) {
      throw new ValidationError('Nenhuma preferência informada.');
    }

    const existing = await this.repo.find(command.tenantId, command.userId);
    const current = existing?.settings ?? { ...DEFAULT_USER_SETTINGS };
    const next = applyPatch(current, command.patch);

    await this.repo.save({
      tenantId: command.tenantId,
      userId: command.userId,
      settings: next,
      updatedAt: new Date(),
    });

    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.userId,
      action: 'settings.updated',
      resource: `user:${command.userId}`,
      metadata: { fields: keys },
    });

    return next;
  }
}
