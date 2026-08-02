import type { ResourceResponse, TenantBranding } from '@navix/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ResolveTenantBrandingUseCase } from '../application/resolve-tenant-branding.use-case';

import { ResolveTenantBrandingQueryDto } from './dto/tenant-branding.dto';

@ApiTags('public-enterprise')
@Controller({ path: 'public/enterprise/branding', version: '1' })
export class PublicTenantBrandingController {
  constructor(private readonly resolveBranding: ResolveTenantBrandingUseCase) {}

  @Get('resolve')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resolve a marca pública por subdomínio ou domínio verificado' })
  async resolve(
    @Query() query: ResolveTenantBrandingQueryDto,
  ): Promise<ResourceResponse<TenantBranding | null>> {
    return { data: await this.resolveBranding.execute(query.host) };
  }
}
