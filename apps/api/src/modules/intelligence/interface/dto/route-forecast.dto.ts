import {
  VEHICLE_TYPES,
  type DriverProfileInput,
  type ForecastStopInput,
  type RouteForecastRequest,
  type VehicleType,
} from '@navix/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { TimeWindowDto } from '../../../delivery/interface/dto/time-window.dto';

class ForecastOriginDto {
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
}

export class ForecastStopDto implements ForecastStopInput {
  @ApiProperty()
  @IsString()
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

  @ApiPropertyOptional({ type: TimeWindowDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeWindowDto)
  timeWindow?: TimeWindowDto | null;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  serviceTimeMinutes?: number;
}

export class DriverProfileDto implements DriverProfileInput {
  @ApiPropertyOptional({ example: 1.1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  speedFactor?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  serviceTimeMinutes?: number;

  @ApiPropertyOptional({ example: 0.92 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  punctuality?: number;
}

export class RouteForecastDto implements RouteForecastRequest {
  @ApiProperty({ type: [ForecastStopDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ForecastStopDto)
  stops!: ForecastStopDto[];

  @ApiPropertyOptional({ enum: VEHICLE_TYPES })
  @IsOptional()
  @IsIn(VEHICLE_TYPES as readonly string[])
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ type: ForecastOriginDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ForecastOriginDto)
  origin?: ForecastOriginDto | null;

  @ApiPropertyOptional({ example: '2026-07-14T08:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  earliestDeparture?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300)
  averageSpeedKmh?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ type: DriverProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DriverProfileDto)
  driver?: DriverProfileDto;

  @ApiPropertyOptional({ example: 40, description: 'Nível de combustível atual (%).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  currentFuelPercent?: number;
}
