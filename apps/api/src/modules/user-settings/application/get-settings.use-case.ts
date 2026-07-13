import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_USER_SETTINGS, type UserSettings } from '@navix/contracts';

import {
  USER_SETTINGS_REPOSITORY,
  type UserSettingsRepositoryPort,
} from '../domain/ports/user-settings-repository.port';

/**
 * Lê as preferências do usuário. Quando o usuário nunca configurou, retorna os
 * defaults do contrato (sem materializar linha) — leitura sempre bem-sucedida.
 */
@Injectable()
export class GetSettingsUseCase {
  constructor(
    @Inject(USER_SETTINGS_REPOSITORY)
    private readonly repo: UserSettingsRepositoryPort,
  ) {}

  async execute(tenantId: string, userId: string): Promise<UserSettings> {
    const record = await this.repo.find(tenantId, userId);
    return record?.settings ?? { ...DEFAULT_USER_SETTINGS };
  }
}
