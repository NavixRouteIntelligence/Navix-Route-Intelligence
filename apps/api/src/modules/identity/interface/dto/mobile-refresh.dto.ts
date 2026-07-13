import type { MobileRefreshRequest } from '@navix/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Corpo de refresh/logout do cliente **mobile** (modo bearer): o refresh token é
 * **obrigatório** no corpo (diferente do web, que usa cookie). Ver ADR-0015.
 */
export class MobileRefreshDto implements MobileRefreshRequest {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  refreshToken!: string;
}
