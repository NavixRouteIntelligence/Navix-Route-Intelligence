import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PUBLIC_API_SCOPES, type PublicApiScope } from '../../domain/public-api';

export class CreateApiKeyDto {
  @IsString() @MaxLength(120) name!: string;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(PUBLIC_API_SCOPES, { each: true })
  scopes!: PublicApiScope[];
  @IsInt() @Min(1) @Max(10_000) quotaPerMinute = 120;
  @IsOptional() @IsISO8601() expiresAt?: string;
}
