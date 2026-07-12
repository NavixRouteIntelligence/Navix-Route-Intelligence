import { Body, Controller, Delete, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, ResourceResponse, UserProfile } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { GetUserProfileUseCase } from '../application/get-user-profile.use-case';
import { UpdateAvatarUseCase } from '../application/update-avatar.use-case';
import { UpdateUserProfileUseCase } from '../application/update-user-profile.use-case';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Perfil do usuário autenticado. Escopo object-level: cada usuário acessa
 * apenas o próprio perfil (derivado do JWT). Rota base: /api/v1/me/profile
 */
@ApiTags('profile')
@ApiBearerAuth()
@Controller({ path: 'me/profile', version: '1' })
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly getProfile: GetUserProfileUseCase,
    private readonly updateProfile: UpdateUserProfileUseCase,
    private readonly updateAvatar: UpdateAvatarUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lê o perfil do usuário (com defaults derivados)' })
  async get(@CurrentUser() user: AuthenticatedUser): Promise<ResourceResponse<UserProfile>> {
    const data = await this.getProfile.execute(user.tenantId, user.id);
    return { data };
  }

  @Patch()
  @ApiOperation({ summary: 'Atualiza parcialmente o perfil do usuário' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ResourceResponse<UserProfile>> {
    const data = await this.updateProfile.execute({
      tenantId: user.tenantId,
      userId: user.id,
      patch: dto,
    });
    return { data };
  }

  @Put('avatar')
  @ApiOperation({ summary: 'Define o avatar (data URL de imagem)' })
  async setAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAvatarDto,
  ): Promise<ResourceResponse<UserProfile>> {
    const data = await this.updateAvatar.execute(user.tenantId, user.id, dto.avatar);
    return { data };
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove o avatar do usuário' })
  async removeAvatar(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResourceResponse<UserProfile>> {
    const data = await this.updateAvatar.execute(user.tenantId, user.id, null);
    return { data };
  }
}
