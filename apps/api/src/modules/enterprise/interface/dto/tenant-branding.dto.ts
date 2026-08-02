import type { UpdateTenantBrandingRequest } from '@navix/contracts';
import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export class ResolveTenantBrandingQueryDto {
  @IsString()
  @MaxLength(253)
  host!: string;
}

export class UpdateTenantBrandingDto implements UpdateTenantBrandingRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  logoUrl?: string | null;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  customDomain?: string | null;
}
