import type { VoiceCommandRequest } from '@navix/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VoiceCommandDto implements VoiceCommandRequest {
  @ApiProperty({ example: 'Qual a próxima parada?' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  transcript!: string;

  @ApiPropertyOptional({ example: 'pt-BR' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;
}
