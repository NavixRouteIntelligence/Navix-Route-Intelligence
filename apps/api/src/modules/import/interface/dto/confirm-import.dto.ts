import type { ConfirmImportRequest } from '@navix/contracts';
import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmImportDto implements ConfirmImportRequest {
  @IsOptional()
  @IsBoolean()
  optimize?: boolean;
}
