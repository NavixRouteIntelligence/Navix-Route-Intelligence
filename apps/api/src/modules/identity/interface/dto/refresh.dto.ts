import type { RefreshRequest } from '@navix/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshDto implements RefreshRequest {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  refreshToken!: string;
}
