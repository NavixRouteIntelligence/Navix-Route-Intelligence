import type { LoginRequest } from '@navix/contracts';
import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Validação da requisição de login (ver docs/api.md §9). */
export class LoginDto implements LoginRequest {
  /** Tenant alvo. No futuro pode ser resolvido por subdomínio em vez do body. */
  @IsUUID()
  tenantId!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
