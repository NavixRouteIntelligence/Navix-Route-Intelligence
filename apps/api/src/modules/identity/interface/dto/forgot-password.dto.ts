import type { ForgotPasswordRequest, ResetPasswordRequest } from '@navix/contracts';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  /** Identificador (slug) da empresa — opcional, para desambiguação (ADR-0016). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  organization?: string;
}

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
