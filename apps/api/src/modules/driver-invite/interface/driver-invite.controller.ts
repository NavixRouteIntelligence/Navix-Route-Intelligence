import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, DriverInvite, ResourceResponse } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { CreateDriverInviteUseCase } from '../application/create-driver-invite.use-case';
import { CreateDriverInviteDto } from './dto/create-driver-invite.dto';

/**
 * Emissão do convite (ADR-0085) — o lado **autenticado** da feature.
 *
 * `admin` e `fleet_manager` convidam, os mesmos papéis que já cadastram e
 * editam a ficha do motorista. `dispatcher` fica de fora de propósito: quem
 * despacha rotas não decide quem entra na organização.
 *
 * O tenant do convite é sempre o de quem convida (`user.tenantId`, vindo do
 * JWT) — nunca do corpo da requisição.
 */
@ApiTags('fleet')
@ApiBearerAuth()
@Controller({ path: 'fleet/drivers/invites', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriverInviteController {
  constructor(private readonly createInvite: CreateDriverInviteUseCase) {}

  @Post()
  @Roles('admin', 'fleet_manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convida um motorista a criar conta na organização' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDriverInviteDto,
  ): Promise<ResourceResponse<DriverInvite>> {
    const data = await this.createInvite.execute({
      tenantId: user.tenantId,
      invitedBy: user.id,
      email: dto.email,
      driverId: dto.driverId,
    });
    return { data };
  }
}
