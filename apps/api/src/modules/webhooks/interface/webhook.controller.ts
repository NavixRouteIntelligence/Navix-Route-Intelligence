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
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { WebhookSubscriptionService } from '../application/webhook-subscription.service';

import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller({ path: 'integrations/webhooks', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WebhookController {
  constructor(private readonly subscriptions: WebhookSubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Registra um webhook; o segredo é exibido uma única vez' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWebhookDto) {
    return this.subscriptions.create({ tenantId: user.tenantId, ...dto });
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.list(user.tenantId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.subscriptions.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.remove(user.tenantId, id);
  }
}
