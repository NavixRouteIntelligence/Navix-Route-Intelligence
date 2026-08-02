import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

import {
  PUBLIC_WEBHOOK_EVENTS,
  type PublicWebhookEvent,
} from '../../../public-api/domain/public-api';

export class CreateWebhookDto {
  @IsString() @MaxLength(120) name!: string;
  @IsUrl({ require_protocol: true, protocols: ['https'] }) url!: string;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(PUBLIC_WEBHOOK_EVENTS, { each: true })
  events!: PublicWebhookEvent[];
}

export class UpdateWebhookDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) url?: string;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(PUBLIC_WEBHOOK_EVENTS, { each: true })
  events?: PublicWebhookEvent[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}
