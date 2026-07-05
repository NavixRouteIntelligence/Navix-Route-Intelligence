import {
  DELIVERY_PRIORITIES,
  OPTIMIZATION_STRATEGIES,
  type DeliveryPriority,
  type OptimizationStopInput,
  type OptimizationStrategyName,
  type OptimizeRouteRequest,
  type OriginInput,
} from '@navix/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { TimeWindowDto } from '../../../delivery/interface/dto/time-window.dto';

export class OriginDto implements OriginInput {
  @ApiProperty({ example: -23.55 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -46.63 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class OptimizationStopDto implements OptimizationStopInput {
  @ApiProperty({ description: 'Identificador da parada (id livre ou id de entrega).' })
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ enum: DELIVERY_PRIORITIES })
  @IsOptional()
  @IsIn(DELIVERY_PRIORITIES as readonly string[])
  priority?: DeliveryPriority;

  @ApiPropertyOptional({ type: TimeWindowDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeWindowDto)
  timeWindow?: TimeWindowDto | null;
}

export class OptimizeRouteDto implements OptimizeRouteRequest {
  @ApiPropertyOptional({ type: OriginDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => OriginDto)
  origin?: OriginDto | null;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID('all', { each: true })
  deliveryIds?: string[];

  @ApiPropertyOptional({ type: [OptimizationStopDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OptimizationStopDto)
  stops?: OptimizationStopDto[];

  @ApiPropertyOptional({ enum: OPTIMIZATION_STRATEGIES })
  @IsOptional()
  @IsIn(OPTIMIZATION_STRATEGIES as readonly string[])
  strategy?: OptimizationStrategyName;

  @ApiPropertyOptional({ example: 30, description: 'Velocidade média (km/h).' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300)
  averageSpeedKmh?: number;

  @ApiPropertyOptional({ example: 5, description: 'Tempo de serviço por parada (min).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  serviceTimeMinutes?: number;
}
