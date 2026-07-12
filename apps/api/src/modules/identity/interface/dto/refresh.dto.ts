import type { RefreshRequest } from '@navix/contracts';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * No fluxo web o refresh token vem no **cookie HttpOnly** e o corpo fica vazio;
 * por isso `refreshToken` é opcional. Clientes em modo *bearer* (mobile) enviam
 * o token no corpo (ver auth-cookie.ts / docs/security.md §2).
 */
export class RefreshDto implements RefreshRequest {
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  refreshToken?: string;
}
