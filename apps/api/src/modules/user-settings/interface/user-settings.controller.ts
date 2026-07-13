import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, ResourceResponse, UserSettings } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { GetSettingsUseCase } from '../application/get-settings.use-case';
import { UpdateSettingsUseCase } from '../application/update-settings.use-case';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Preferências do usuário autenticado (Tema, Idioma, Preferências de UI).
 * Escopo object-level: cada usuário só acessa as próprias preferências
 * (derivadas do JWT); qualquer papel autenticado pode ler/gravar as suas.
 * Rota base: /api/v1/me/settings
 */
@ApiTags('settings')
@ApiBearerAuth()
@Controller({ path: 'me/settings', version: '1' })
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(
    private readonly getSettings: GetSettingsUseCase,
    private readonly updateSettings: UpdateSettingsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lê as preferências do usuário (com defaults)' })
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResourceResponse<UserSettings>> {
    const data = await this.getSettings.execute(user.tenantId, user.id);
    return { data };
  }

  @Patch()
  @ApiOperation({ summary: 'Atualiza parcialmente as preferências do usuário' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<ResourceResponse<UserSettings>> {
    const data = await this.updateSettings.execute({
      tenantId: user.tenantId,
      userId: user.id,
      patch: dto,
    });
    return { data };
  }
}
