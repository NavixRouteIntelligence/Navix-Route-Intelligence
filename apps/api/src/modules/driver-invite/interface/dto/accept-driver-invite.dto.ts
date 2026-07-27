import type { AcceptDriverInviteRequest } from '@navix/contracts';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Note o que **não** está aqui: e-mail e tenant. Ambos vêm do token do convite.
 * Aceitar qualquer um dos dois do cliente seria abrir a porta para criar conta
 * em organização alheia (ADR-0085).
 */
export class AcceptDriverInviteDto implements AcceptDriverInviteRequest {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  /** Exigido apenas quando o convite não aponta para uma ficha existente. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  licenseNumber?: string;
}
