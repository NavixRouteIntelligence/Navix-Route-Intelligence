import {
  DELIVERY_PRIORITIES,
  ECONOMY_MODES,
  OPTIMIZATION_STRATEGIES,
  VEHICLE_TYPES,
  type DeliveryPriority,
  type EconomyMode,
  type OptimizationStopInput,
  type OptimizationStrategyName,
  type OptimizationVehicleInput,
  type OptimizeRouteRequest,
  type OriginInput,
  type VehicleType,
} from '@navix/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { TimeWindowDto } from '../../../../shared/interface/time-window.dto';

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

  @ApiPropertyOptional({ example: 12.5, description: 'Demanda de peso (kg).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ example: 0.3, description: 'Demanda de volume (m³).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeM3?: number;

  @ApiPropertyOptional({ example: 8, description: 'Tempo de serviço específico da parada (min).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  serviceTimeMinutes?: number;
}

export class OptimizationVehicleDto implements OptimizationVehicleInput {
  @ApiPropertyOptional({ enum: VEHICLE_TYPES, description: 'Tipo do veículo (define defaults).' })
  @IsOptional()
  @IsIn(VEHICLE_TYPES as readonly string[])
  type?: VehicleType;

  @ApiPropertyOptional({ example: 1200, description: 'Sobrepõe a capacidade de peso (kg).' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacityKg?: number;

  @ApiPropertyOptional({ example: 8, description: 'Sobrepõe a capacidade de volume (m³).' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacityVolumeM3?: number;

  @ApiPropertyOptional({ example: false, description: 'Preferência por evitar pedágios.' })
  @IsOptional()
  @IsBoolean()
  avoidTolls?: boolean;
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

  @ApiPropertyOptional({ enum: ECONOMY_MODES, description: 'Modo Economia (ADR-0026).' })
  @IsOptional()
  @IsIn(ECONOMY_MODES as readonly string[])
  economyMode?: EconomyMode;

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

  @ApiPropertyOptional({ type: OptimizationVehicleDto, description: 'Perfil do veículo (ADR-0022).' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptimizationVehicleDto)
  vehicle?: OptimizationVehicleDto;

  @ApiPropertyOptional({
    type: [OptimizationVehicleDto],
    description: 'Frota para roteirização multi-veículo (ADR-0022, Fase 2).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OptimizationVehicleDto)
  vehicles?: OptimizationVehicleDto[];
}
