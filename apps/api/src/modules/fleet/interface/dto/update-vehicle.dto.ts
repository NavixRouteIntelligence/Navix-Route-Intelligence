import {
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type UpdateVehicleRequest,
  type VehicleStatus,
  type VehicleType,
} from '@navix/contracts';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateVehicleDto implements UpdateVehicleRequest {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  plate?: string;

  @IsOptional()
  @IsIn(VEHICLE_TYPES as readonly string[])
  type?: VehicleType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity?: number;

  @IsOptional()
  @IsIn(VEHICLE_STATUSES as readonly string[])
  status?: VehicleStatus;
}
