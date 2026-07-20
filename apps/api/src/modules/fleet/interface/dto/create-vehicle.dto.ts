import {
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type CreateVehicleRequest,
  type VehicleStatus,
  type VehicleType,
} from '@navix/contracts';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateVehicleDto implements CreateVehicleRequest {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  plate!: string;

  @IsIn(VEHICLE_TYPES as readonly string[])
  type!: VehicleType;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity!: number;

  @IsOptional()
  @IsIn(VEHICLE_STATUSES as readonly string[])
  status?: VehicleStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  odometerKm?: number;
}
