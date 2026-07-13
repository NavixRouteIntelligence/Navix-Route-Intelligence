import type { PositionBatchRequest } from '@navix/contracts';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';

import { UpdatePositionDto } from './update-position.dto';

/** Corpo do envio em lote de posições (1 a 500 por requisição). */
export class PositionBatchDto implements PositionBatchRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpdatePositionDto)
  positions!: UpdatePositionDto[];
}
