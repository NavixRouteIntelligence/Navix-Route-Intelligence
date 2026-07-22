import { HISTORY_GRANULARITIES, type HistoryGranularity } from '@navix/contracts';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

/** Intervalo do resumo/extrato/histórico. Default: últimos 30 dias (no controller). */
export class PeriodQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Granularidade do histórico (semana/mês). Ignorada por resumo/extrato. */
  @IsOptional()
  @IsIn(HISTORY_GRANULARITIES as readonly string[])
  granularity?: HistoryGranularity;
}
