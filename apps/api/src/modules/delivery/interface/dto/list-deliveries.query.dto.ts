import {
  DELIVERY_PRIORITIES,
  DELIVERY_STATUSES,
  type DeliveryPriority,
  type DeliveryStatus,
} from '@navix/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Query de listagem de entregas: paginação, filtros e ordenação (docs/api.md §8). */
export class ListDeliveriesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ enum: DELIVERY_STATUSES })
  @IsOptional()
  @IsIn(DELIVERY_STATUSES as readonly string[])
  status?: DeliveryStatus;

  @ApiPropertyOptional({ enum: DELIVERY_PRIORITIES })
  @IsOptional()
  @IsIn(DELIVERY_PRIORITIES as readonly string[])
  priority?: DeliveryPriority;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({ description: 'Filtra janelas com início >= este instante (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  windowFrom?: string;

  @ApiPropertyOptional({ description: 'Filtra janelas com início <= este instante (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  windowTo?: string;

  @ApiPropertyOptional({
    description: 'Campos separados por vírgula; prefixo "-" para descendente. Ex.: -createdAt,priority',
    example: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
