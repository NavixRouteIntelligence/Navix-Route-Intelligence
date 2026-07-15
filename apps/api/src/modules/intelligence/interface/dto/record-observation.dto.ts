import {
  PARKING_DIFFICULTIES,
  type ObservationKind,
  type ParkingDifficulty,
  type RecordObservationRequest,
} from '@navix/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const OBSERVATION_KINDS: readonly ObservationKind[] = ['parking', 'service_time', 'access'];

export class RecordObservationDto implements RecordObservationRequest {
  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ enum: OBSERVATION_KINDS as readonly string[] })
  @IsIn(OBSERVATION_KINDS as readonly string[])
  kind!: ObservationKind;

  @ApiPropertyOptional({ enum: PARKING_DIFFICULTIES })
  @IsOptional()
  @IsIn(PARKING_DIFFICULTIES as readonly string[])
  parkingDifficulty?: ParkingDifficulty;

  @ApiPropertyOptional({ example: 6.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(600)
  serviceMinutes?: number;

  @ApiPropertyOptional({ example: 'Entrar pela portaria de serviço; interfone 12.' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  accessTip?: string;
}
