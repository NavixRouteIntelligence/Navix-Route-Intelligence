import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, ResourceResponse, TrackingLinkResponse } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { IssueTrackingLinkUseCase } from '../application/issue-tracking-link.use-case';

/**
 * Emissão do link público de rastreamento (ADR-0082) — o lado **autenticado**
 * da feature, usado pelo despachante.
 *
 * A rota mora sob `/deliveries/:id` porque é assim que o cliente a enxerga,
 * mas o controller vive no módulo `public-tracking`: quem é dono do token é
 * esta feature, não o Delivery. Path e módulo são independentes no Nest.
 */
@ApiTags('deliveries')
@ApiBearerAuth()
@Controller({ path: 'deliveries', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingLinkController {
  constructor(private readonly issueTrackingLink: IssueTrackingLinkUseCase) {}

  @Post(':id/tracking-link')
  @Roles('admin', 'dispatcher')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Emite (ou recupera) o link público de rastreamento' })
  async trackingLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponse<TrackingLinkResponse>> {
    // Idempotente: reemitir devolve o link vigente, para não invalidar o que o
    // destinatário já recebeu.
    const data = await this.issueTrackingLink.execute(user.tenantId, id);
    return { data };
  }
}
