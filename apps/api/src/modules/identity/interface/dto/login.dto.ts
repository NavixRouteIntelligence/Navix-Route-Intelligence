import type { LoginRequest } from '@navix/contracts';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Validação do login (ver docs/api.md §5). O tenant é resolvido pelo e-mail
 * (ou pelo `organization`/slug, opcional) — sem `tenantId` (ADR-0016).
 */
export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** Identificador (slug) da empresa — opcional, para desambiguação. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  organization?: string;
}
