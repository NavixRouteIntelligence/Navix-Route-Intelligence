import type { AuthenticatedUser } from '@navix/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { ApiKeyService } from '../application/api-key.service';

import { CreateApiKeyDto } from './dto/api-key.dto';

@ApiTags('public-api-keys')
@ApiBearerAuth()
@Controller({ path: 'integrations/api-keys', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ApiKeyController {
  constructor(private readonly keys: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Cria chave pública; o segredo é exibido uma única vez' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApiKeyDto) {
    return this.keys.create({ tenantId: user.tenantId, ...dto });
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.keys.list(user.tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.keys.revoke(user.tenantId, id);
  }
}
