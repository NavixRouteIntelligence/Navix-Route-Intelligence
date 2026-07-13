import type { UpdateProfileRequest } from '@navix/contracts';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * Patch parcial do perfil. Validações de formato (E.164, tamanhos finos)
 * ficam no domínio; aqui aplicam-se guardas de tipo/tamanho na borda.
 * `phone`/`jobTitle` aceitam `null` para limpar o campo.
 */
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(80)
  jobTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}
