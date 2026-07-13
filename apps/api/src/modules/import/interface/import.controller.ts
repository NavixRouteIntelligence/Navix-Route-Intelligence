import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  CollectionResponse,
  ConfirmImportResponse,
  ImportBatchView,
  ImportConnectorDescriptor,
  ImportFileType,
  ImportPreviewResponse,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { ValidationError } from '../../../shared/kernel/domain-error';
import { buildCollection } from '../../../shared/kernel/pagination';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Idempotent } from '../../../shared/idempotency/idempotency.decorator';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { ConfirmImportUseCase } from '../application/confirm-import.use-case';
import { GetImportUseCase } from '../application/get-import.use-case';
import { ListConnectorsUseCase } from '../application/list-connectors.use-case';
import { ListImportsUseCase } from '../application/list-imports.use-case';
import { PreviewImportUseCase } from '../application/preview-import.use-case';
import { ListQueryDto } from './dto/list-query.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';

const BASE_PATH = '/api/v1/imports';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

function detectFileType(filename: string): ImportFileType {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  throw new ValidationError('Formato não suportado. Use CSV, XLSX ou PDF.');
}

@ApiTags('imports')
@ApiBearerAuth()
@Controller({ path: 'imports', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(
    private readonly preview: PreviewImportUseCase,
    private readonly confirm: ConfirmImportUseCase,
    private readonly getImport: GetImportUseCase,
    private readonly listImports: ListImportsUseCase,
    private readonly listConnectors: ListConnectorsUseCase,
  ) {}

  @Get('connectors')
  @ApiOperation({ summary: 'Catálogo de conectores (disponíveis e planejados)' })
  connectors(): { data: ImportConnectorDescriptor[] } {
    return { data: this.listConnectors.execute() };
  }

  @Post('preview')
  @Roles('admin', 'dispatcher', 'driver')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envia um arquivo e gera a pré-visualização da importação' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async previewHandler(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ImportPreviewResponse> {
    if (!file) {
      throw new ValidationError('Arquivo não enviado (campo "file").');
    }
    return this.preview.execute({
      tenantId: user.tenantId,
      actorId: user.id,
      filename: file.originalname,
      fileType: detectFileType(file.originalname),
      buffer: file.buffer,
    });
  }

  @Post(':id/confirm')
  @Roles('admin', 'dispatcher', 'driver')
  @Idempotent()
  @ApiOperation({ summary: 'Confirma a importação: cria entregas e (opcional) otimiza' })
  confirmHandler(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmImportDto,
  ): Promise<ConfirmImportResponse> {
    return this.confirm.execute({
      tenantId: user.tenantId,
      actorId: user.id,
      batchId: id,
      optimize: dto.optimize ?? false,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Histórico de importações' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ): Promise<CollectionResponse<ImportBatchView>> {
    const result = await this.listImports.execute(user.tenantId, query.page, query.pageSize);
    return buildCollection(result.items, result.total, result.page, BASE_PATH);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma importação (linhas + erros)' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImportPreviewResponse> {
    return this.getImport.execute(user.tenantId, id);
  }
}
