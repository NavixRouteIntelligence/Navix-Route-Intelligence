import type { UpdateAvatarRequest } from '@navix/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Corpo do upload de avatar (data URL de imagem). */
export class UpdateAvatarDto implements UpdateAvatarRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(2_800_000) // ~2 MB em base64 (validação fina de tipo/tamanho no domínio)
  avatar!: string;
}
