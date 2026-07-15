import {
  VEHICLE_TYPES,
  type LoadItemInput,
  type LoadPlanRequest,
  type VehicleType,
} from '@navix/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LoadItemDto implements LoadItemInput {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty({ example: 1, description: 'Ordem de entrega (1 = primeira a sair).' })
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ example: 0.08 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeM3?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  fragile?: boolean;

  @ApiPropertyOptional({ example: 'Cliente A · NF 1234' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class LoadPlanDto implements LoadPlanRequest {
  @ApiProperty({ type: [LoadItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LoadItemDto)
  items!: LoadItemDto[];

  @ApiPropertyOptional({ enum: VEHICLE_TYPES })
  @IsOptional()
  @IsIn(VEHICLE_TYPES as readonly string[])
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacityKg?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacityVolumeM3?: number;
}
