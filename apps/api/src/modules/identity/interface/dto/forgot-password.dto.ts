import type { ForgotPasswordRequest, ResetPasswordRequest } from '@navix/contracts';
import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @IsUUID()
  tenantId!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;
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
