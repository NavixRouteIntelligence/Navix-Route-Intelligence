import type { AddressInput } from '@navix/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AddressDto implements AddressInput {
  @ApiProperty({ example: 'Av. Paulista' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street!: string;

  @ApiProperty({ example: '1000' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  number!: string;

  @ApiPropertyOptional({ example: 'Apto 42', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  complement?: string | null;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: 'SP' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  state!: string;

  @ApiProperty({ example: '01310-100' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode!: string;

  @ApiProperty({ example: 'BR' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  country!: string;

  @ApiProperty({ example: -23.561, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -46.656, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
