'use client';

import type { DriverPerformanceView } from '@navix/contracts';
import { useQuery } from '@tanstack/react-query';
import { Coffee, Flame, Target } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { analyticsApi } from '@/lib/api/analytics';
import { useT } from '@/lib/i18n/locale-provider';

/**
 * Desempenho consolidado do motorista (ADR-0097).
 *
 * ## O que este card recusa mostrar
 *
 * Não há posição na frota, média dos colegas, entregas por hora nem velocidade.
 * O contrato que alimenta esta tela não tem esses campos — a restrição está no
 * domínio (`analytics/domain/driver-performance.ts`), não em uma decisão de
 * layout que a próxima iteração de design possa desfazer sem perceber.
 *
 * A sugestão de descanso aparece **apenas** quando o dia foi longo, e é a única
 * mensagem do card que pede uma ação. Ela pede para parar.
 */
export function DriverPerformanceCard() {
  const t = useT();
  const query = useQuery({
    queryKey: ['driver-performance'],
    queryFn: () => analyticsApi.myPerformance(30),
  });

  const data = query.data?.data;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle id="driver-performance-title">{t('perf.title')}</CardTitle>
        <span className="text-xs text-muted-foreground">{t('perf.window')}</span>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !data || data.workedDays === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t('perf.empty')}</p>
        ) : (
          <>
            <dl
              className="grid grid-cols-2 gap-4 sm:grid-cols-4"
              aria-labelledby="driver-performance-title"
            >
              <Metric label={t('perf.delivered')} value={String(data.delivered)} />
              <Metric label={t('perf.workedDays')} value={String(data.workedDays)} />
              <Metric label={t('perf.successRate')} value={percent(data.successRate)} />
              <Metric label={t('perf.onTimeRate')} value={percent(data.onTimeRate)} />
            </dl>

            <Streak streak={data.streak} />
            {data.goal && <Goal goal={data.goal} />}
            {data.restAdvice?.longDay && <RestAdvice minutes={data.restAdvice.activeMinutes} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** `null` vira travessão, não "0%": ainda não haver dado não é ter zero. */
function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * A sequência conta dias **sem falha**, e o rodapé diz isso em texto aberto: um
 * contador cujo critério não está à vista é o que faz alguém trabalhar doente
 * com medo de perder um número que não entende.
 */
function Streak({ streak }: { streak: DriverPerformanceView['streak'] }) {
  const t = useT();
  if (streak.days === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg bg-success/8 p-3">
      <Flame className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {streak.days} {streak.days === 1 ? t('perf.streak.day') : t('perf.streak.days')}
        </p>
        <p className="text-xs text-muted-foreground">{t('perf.streak.hint')}</p>
      </div>
    </div>
  );
}

/**
 * Meta contra a própria média, exposta como barra com `role="progressbar"` e um
 * `aria-valuetext` legível — a barra sozinha não diz nada a quem usa leitor de
 * tela, e este card não tem versão alternativa em outro lugar.
 */
function Goal({ goal }: { goal: NonNullable<DriverPerformanceView['goal']> }) {
  const t = useT();
  const atual = Math.round(goal.current * 100);
  const alvo = Math.round(goal.target * 100);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('perf.goal')}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {atual}% / {alvo}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={atual}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${atual}% ${t('perf.goal.of')} ${alvo}%`}
        aria-label={t('perf.goal')}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full transition-all ${goal.met ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${Math.min(100, atual)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {goal.met ? t('perf.goal.met') : t('perf.goal.hint')}
      </p>
    </div>
  );
}

/**
 * `role="status"` e não `alert`: é um cuidado, não uma emergência — `alert`
 * interrompe quem está usando leitor de tela no meio de outra leitura.
 */
function RestAdvice({ minutes }: { minutes: number }) {
  const t = useT();
  const horas = Math.floor(minutes / 60);

  return (
    <div role="status" className="flex items-start gap-3 rounded-lg bg-warning/10 p-3">
      <Coffee className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {t('perf.rest.title')} {horas}
          {t('perf.rest.hours')}
        </p>
        <p className="text-xs text-muted-foreground">{t('perf.rest.hint')}</p>
      </div>
    </div>
  );
}
