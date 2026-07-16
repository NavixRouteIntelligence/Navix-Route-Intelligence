import type { TimeWindowInput } from '@navix/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/**
 * Janela de tempo (SLA) — DTO **compartilhado** (ADR-0045). Vive no `shared` em
 * vez de num módulo de negócio para que optimizer, intelligence e delivery o
 * reutilizem sem depender do `interface` uns dos outros.
 */
export class TimeWindowDto implements TimeWindowInput {
  @ApiProperty({ example: '2026-07-06T09:00:00Z', description: 'Início (ISO 8601 UTC).' })
  @IsDateString()
  start!: string;

  @ApiProperty({ example: '2026-07-06T12:00:00Z', description: 'Fim (ISO 8601 UTC).' })
  @IsDateString()
  end!: string;
}
