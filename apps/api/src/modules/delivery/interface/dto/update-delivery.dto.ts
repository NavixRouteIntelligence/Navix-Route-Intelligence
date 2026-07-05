import {
  DELIVERY_PRIORITIES,
  type DeliveryPriority,
  type UpdateDeliveryRequest,
} from '@navix/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { AddressDto } from './address.dto';
import { TimeWindowDto } from './time-window.dto';

export class UpdateDeliveryDto implements UpdateDeliveryRequest {
  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({ enum: DELIVERY_PRIORITIES })
  @IsOptional()
  @IsIn(DELIVERY_PRIORITIES as readonly string[])
  priority?: DeliveryPriority;

  @ApiPropertyOptional({ type: TimeWindowDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeWindowDto)
  timeWindow?: TimeWindowDto;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  driverId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  vehicleId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  routeId?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
