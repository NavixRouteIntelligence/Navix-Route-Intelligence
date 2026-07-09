import type { CreatePodRequest, PodStatus } from '@navix/contracts';
import { POD_STATUSES } from '@navix/contracts';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePodDto implements CreatePodRequest {
  @IsUUID()
  deliveryId!: string;

  @IsIn(POD_STATUSES as readonly string[])
  status!: PodStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @IsOptional()
  @IsLatitude()
  latitude?: number | null;

  @IsOptional()
  @IsLongitude()
  longitude?: number | null;

  @IsOptional()
  @IsString()
  photo?: string | null;

  @IsOptional()
  @IsString()
  signature?: string | null;
}
