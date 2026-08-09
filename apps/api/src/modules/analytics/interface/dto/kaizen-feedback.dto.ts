import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';

/** Resposta ao Kaizen do dia (ADR-0121). Sem texto livre, de propósito. */
export class KaizenFeedbackDto {
  @ApiProperty({ example: '2026-08-08' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'day deve ser YYYY-MM-DD.' })
  day!: string;

  @ApiProperty({ example: 'rest.long-day' })
  @IsString()
  code!: string;

  @ApiProperty({ enum: ['useful', 'not-applicable'] })
  @IsIn(['useful', 'not-applicable'])
  verdict!: 'useful' | 'not-applicable';

  @ApiPropertyOptional({ enum: ['wrong-data', 'already-done', 'out-of-context', 'other'] })
  @IsOptional()
  @IsIn(['wrong-data', 'already-done', 'out-of-context', 'other'])
  reason?: 'wrong-data' | 'already-done' | 'out-of-context' | 'other';
}

export class KaizenPreferencesDto {
  @ApiProperty({ description: 'Esconde as sugestões; os resultados continuam.' })
  @IsBoolean()
  hideRecommendations!: boolean;
}
