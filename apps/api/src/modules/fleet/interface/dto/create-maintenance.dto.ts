import {
  MAINTENANCE_TYPES,
  type CreateMaintenanceRecordRequest,
  type MaintenanceType,
} from '@navix/contracts';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMaintenanceDto implements CreateMaintenanceRecordRequest {
  @IsIn(MAINTENANCE_TYPES as readonly string[])
  type!: MaintenanceType;

  @IsISO8601()
  performedAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  odometerKm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  cost?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsISO8601()
  nextDueDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  nextDueOdometerKm?: number | null;
}
