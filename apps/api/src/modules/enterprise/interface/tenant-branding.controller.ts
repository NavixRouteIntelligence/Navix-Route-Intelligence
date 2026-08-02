import type { AuthenticatedUser, ResourceResponse, TenantBrandingAdmin } from '@navix/contracts';
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { GetTenantBrandingUseCase } from '../application/get-tenant-branding.use-case';
import { UpdateTenantBrandingUseCase } from '../application/update-tenant-branding.use-case';
import { VerifyCustomDomainUseCase } from '../application/verify-custom-domain.use-case';

import { UpdateTenantBrandingDto } from './dto/tenant-branding.dto';

@ApiTags('enterprise')
@ApiBearerAuth()
@Controller({ path: 'enterprise/branding', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantBrandingController {
  constructor(
    private readonly getBranding: GetTenantBrandingUseCase,
    private readonly updateBranding: UpdateTenantBrandingUseCase,
    private readonly verifyDomain: VerifyCustomDomainUseCase,
  ) {}

  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResourceResponse<TenantBrandingAdmin>> {
    return { data: await this.getBranding.execute(user.tenantId) };
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Atualiza marca e solicita domínio próprio (Enterprise)' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTenantBrandingDto,
  ): Promise<ResourceResponse<TenantBrandingAdmin>> {
    return {
      data: await this.updateBranding.execute({
        tenantId: user.tenantId,
        actorId: user.id,
        patch: dto,
      }),
    };
  }

  @Post('domain/verify')
  @Roles('admin')
  @ApiOperation({ summary: 'Confirma a posse do domínio pelo registro DNS TXT' })
  async verify(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResourceResponse<TenantBrandingAdmin>> {
    return { data: await this.verifyDomain.execute(user.tenantId, user.id) };
  }
}
