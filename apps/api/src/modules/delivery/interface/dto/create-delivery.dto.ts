import {
  DELIVERY_PRIORITIES,
  type CreateDeliveryRequest,
  type DeliveryPriority,
} from '@navix/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { AddressDto } from './address.dto';
import { TimeWindowDto } from '../../../../shared/interface/time-window.dto';

export class CreateDeliveryDto implements CreateDeliveryRequest {
  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @ApiPropertyOptional({ enum: DELIVERY_PRIORITIES, default: 'normal' })
  @IsOptional()
  @IsIn(DELIVERY_PRIORITIES as readonly string[])
  priority?: DeliveryPriority;

  @ApiProperty({ type: TimeWindowDto })
  @ValidateNested()
  @Type(() => TimeWindowDto)
  timeWindow!: TimeWindowDto;

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

  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipient?: string | null;

  // Contato do destinatário (ADR-0084). `IsEmail` com `require_tld` relaxado
  // aceita domínios de teste; o domínio ainda normaliza e descarta o inválido.
  @IsOptional()
  @IsEmail({}, { message: 'recipientEmail deve ser um e-mail válido.' })
  @MaxLength(320)
  recipientEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  recipientPhone?: string | null;

}
