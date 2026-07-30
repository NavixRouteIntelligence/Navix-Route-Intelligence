import type { CreateDriverInviteRequest } from '@navix/contracts';
import { IsEmail, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateDriverInviteDto implements CreateDriverInviteRequest {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  /** Ficha existente a ligar. Omitido → a ficha é criada no aceite. */
  @IsOptional()
  @IsUUID()
  driverId?: string;
}
