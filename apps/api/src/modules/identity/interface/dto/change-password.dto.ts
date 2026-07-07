import type { ChangePasswordRequest } from '@navix/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
