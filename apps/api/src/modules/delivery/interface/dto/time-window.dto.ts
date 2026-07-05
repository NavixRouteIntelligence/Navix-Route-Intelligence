import type { TimeWindowInput } from '@navix/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class TimeWindowDto implements TimeWindowInput {
  @ApiProperty({ example: '2026-07-06T09:00:00Z', description: 'Início (ISO 8601 UTC).' })
  @IsDateString()
  start!: string;

  @ApiProperty({ example: '2026-07-06T12:00:00Z', description: 'Fim (ISO 8601 UTC).' })
  @IsDateString()
  end!: string;
}
