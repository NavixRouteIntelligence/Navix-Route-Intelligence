import { IsISO8601, IsOptional } from 'class-validator';

/** Intervalo do resumo/extrato. Default: últimos 30 dias (resolvido no controller). */
export class PeriodQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
