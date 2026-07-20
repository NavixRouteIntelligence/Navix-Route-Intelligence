import {
  FINANCIAL_CATEGORIES,
  type CreateFinancialEntryRequest,
  type FinancialCategory,
  type FinancialEntryType,
} from '@navix/contracts';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFinancialEntryDto implements CreateFinancialEntryRequest {
  @IsIn(['income', 'expense'])
  type!: FinancialEntryType;

  @IsIn(FINANCIAL_CATEGORIES as readonly string[])
  category!: FinancialCategory;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  amount!: number;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  odometerKm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000)
  liters?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
