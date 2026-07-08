import type { PositionUpdateRequest, TrackingStatus } from '@navix/contracts';
import {
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdatePositionDto implements PositionUpdateRequest {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsISO8601()
  recordedAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(400)
  speed?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number | null;

  @IsOptional()
  @IsIn(['en_route', 'finished'])
  status?: Exclude<TrackingStatus, 'offline'>;
}
