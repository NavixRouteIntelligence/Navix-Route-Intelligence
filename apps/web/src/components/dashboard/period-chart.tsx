'use client';

import type { RoutePlan } from '@navix/contracts';
import { useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useTokenColors } from '@/components/charts/use-token-colors';
import { cn } from '@/lib/utils';

type Period = 'daily' | 'weekly' | 'monthly';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Diário' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensal' },
];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function weekKey(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

type Bucket = { label: string; planned: number; optimized: number };

function buildBuckets(plans: RoutePlan[], period: Period): Bucket[] {
  const now = new Date();
  const buckets: { key: string; label: string; planned: number; optimized: number }[] = [];

  if (period === 'daily') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      buckets.push({ key: d.toISOString().slice(0, 10), label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, planned: 0, optimized: 0 });
    }
  } else if (period === 'weekly') {
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      buckets.push({ key: weekKey(d), label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, planned: 0, optimized: 0 });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()], planned: 0, optimized: 0 });
    }
  }

  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const p of plans) {
    const d = new Date(p.createdAt);
    const key =
      period === 'daily'
        ? d.toISOString().slice(0, 10)
        : period === 'weekly'
          ? weekKey(d)
          : `${d.getFullYear()}-${d.getMonth()}`;
    const b = map.get(key);
    if (b) {
      b.planned += p.baseline.totalDistanceKm;
      b.optimized += p.metrics.totalDistanceKm;
    }
  }
  return buckets.map(({ label, planned, optimized }) => ({
    label,
    planned: Math.round(planned * 10) / 10,
    optimized: Math.round(optimized * 10) / 10,
  }));
}

const SERIES_LABEL: Record<string, string> = { planned: 'Planejado', optimized: 'Otimizado' };

export function PeriodChart({ plans }: { plans: RoutePlan[] }) {
  const [period, setPeriod] = useState<Period>('daily');
  const [optimized, planned] = useTokenColors(['--chart-1', '--muted-foreground']);
  const muted = planned;
  const data = useMemo(() => buildBuckets(plans, period), [plans, period]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: planned }} /> Planejado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: optimized }} /> Otimizado
          </span>
        </div>
        <div className="flex justify-end gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                period === p.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="optimizedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={optimized} stopOpacity={0.35} />
              <stop offset="100%" stopColor={optimized} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: muted, fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={32} tick={{ fill: muted, fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))' }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              color: 'hsl(var(--foreground))',
            }}
            formatter={(v: number, key: string) => [`${v} km`, SERIES_LABEL[key] ?? key]}
          />
          <Area type="monotone" dataKey="planned" stroke={planned} strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
          <Area type="monotone" dataKey="optimized" stroke={optimized} strokeWidth={2} fill="url(#optimizedGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
