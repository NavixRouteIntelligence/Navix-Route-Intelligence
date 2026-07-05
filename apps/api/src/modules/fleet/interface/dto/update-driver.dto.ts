import {
  DRIVER_STATUSES,
  type DriverStatus,
  type UpdateDriverRequest,
} from '@navix/contracts';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateDriverDto implements UpdateDriverRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  licenseNumber?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  skills?: string[];

  @IsOptional()
  @IsIn(DRIVER_STATUSES as readonly string[])
  status?: DriverStatus;
}
