import type { ConfirmImportRequest } from '@navix/contracts';
import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmImportDto implements ConfirmImportRequest {
  /**
   * @deprecated Ignorado (ADR-0074): a otimização é sempre automática. Mantido
   * aceito para que clientes antigos que ainda enviam o campo não tomem 400 sob
   * `forbidNonWhitelisted`.
   */
  @IsOptional()
  @IsBoolean()
  optimize?: boolean;
}
