import { SYNC_MAX_LIMIT } from '@navix/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query da sincronização incremental de entregas (docs/api.md §8.1, ADR-0020). */
export class SyncDeliveriesQueryDto {
  @ApiPropertyOptional({
    description: 'Marca d’água ISO 8601: só entregas alteradas em/depois deste instante.',
    example: '2026-07-13T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  updatedSince?: string;

  @ApiPropertyOptional({
    description: 'Cursor opaco de keyset devolvido pelo servidor; continua a rodada.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: SYNC_MAX_LIMIT, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SYNC_MAX_LIMIT)
  limit?: number;
}
