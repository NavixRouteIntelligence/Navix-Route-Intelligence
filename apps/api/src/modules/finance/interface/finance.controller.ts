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
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectionResponse,
  FinancialEntry as FinancialEntryView,
  FinancialSummary,
  ResourceResponse,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { buildCollection } from '../../../shared/kernel/pagination';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { CreateFinancialEntryUseCase } from '../application/create-financial-entry.use-case';
import { DeleteFinancialEntryUseCase } from '../application/delete-financial-entry.use-case';
import { GetFinancialSummaryUseCase } from '../application/get-financial-summary.use-case';
import { ListFinancialEntriesUseCase } from '../application/list-financial-entries.use-case';
import { CreateFinancialEntryDto } from './dto/create-financial-entry.dto';
import { PeriodQueryDto } from './dto/period-query.dto';

const BASE_PATH = '/api/v1/finance/entries';

/** Início do dia (UTC) de uma data 'YYYY-MM-DD'. */
function startOfDay(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
/** Fim do dia (UTC) de uma data 'YYYY-MM-DD'. */
function endOfDay(iso: string): Date {
  return new Date(`${iso}T23:59:59.999Z`);
}

/**
 * Ledger financeiro do motorista (FASE 3, F1). O autônomo gere as próprias
 * finanças → papel `driver` (e admin). RLS por tenant garante o isolamento.
 * Período default: últimos 30 dias.
 */
@Controller({ path: 'finance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(
    private readonly createEntry: CreateFinancialEntryUseCase,
    private readonly listEntries: ListFinancialEntriesUseCase,
    private readonly deleteEntry: DeleteFinancialEntryUseCase,
    private readonly getSummary: GetFinancialSummaryUseCase,
  ) {}

  private range(query: PeriodQueryDto): { from: Date; to: Date } {
    const to = query.to ? endOfDay(query.to.slice(0, 10)) : new Date();
    const from = query.from
      ? startOfDay(query.from.slice(0, 10))
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  @Post('entries')
  @Roles('driver', 'admin')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFinancialEntryDto,
  ): Promise<ResourceResponse<FinancialEntryView>> {
    const data = await this.createEntry.execute({ ...dto, tenantId: user.tenantId });
    return { data };
  }

  @Get('entries')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PeriodQueryDto,
  ): Promise<CollectionResponse<FinancialEntryView>> {
    const { from, to } = this.range(query);
    const items = await this.listEntries.execute(user.tenantId, from, to);
    return buildCollection(items, items.length, { page: 1, pageSize: Math.max(items.length, 1) }, BASE_PATH);
  }

  @Get('summary')
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PeriodQueryDto,
  ): Promise<ResourceResponse<FinancialSummary>> {
    const { from, to } = this.range(query);
    const data = await this.getSummary.execute(user.tenantId, from, to);
    return { data };
  }

  @Delete('entries/:id')
  @Roles('driver', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteEntry.execute(user.tenantId, id);
  }
}
