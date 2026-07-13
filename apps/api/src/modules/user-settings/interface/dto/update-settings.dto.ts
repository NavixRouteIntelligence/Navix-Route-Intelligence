import {
  TIME_FORMATS,
  UI_DENSITIES,
  UI_LOCALES,
  UI_THEMES,
  WEEK_STARTS,
  type TimeFormat,
  type UiDensity,
  type UiLocale,
  type UiTheme,
  type UpdateUserSettingsRequest,
  type WeekStart,
} from '@navix/contracts';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

/**
 * Patch parcial das preferências. Todas as chaves são opcionais; enums são
 * validados contra as listas do contrato (defesa na borda, além do domínio).
 */
export class UpdateSettingsDto implements UpdateUserSettingsRequest {
  @IsOptional()
  @IsIn(UI_THEMES as readonly string[])
  theme?: UiTheme;

  @IsOptional()
  @IsIn(UI_LOCALES as readonly string[])
  locale?: UiLocale;

  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;

  @IsOptional()
  @IsBoolean()
  compact?: boolean;

  @IsOptional()
  @IsIn(UI_DENSITIES as readonly string[])
  density?: UiDensity;

  @IsOptional()
  @IsIn(TIME_FORMATS as readonly string[])
  timeFormat?: TimeFormat;

  @IsOptional()
  @IsIn(WEEK_STARTS as readonly string[])
  weekStart?: WeekStart;
}
