'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useTokenColors } from '@/components/charts/use-token-colors';

export interface ChartDatum {
  name: string;
  value: number;
}

export function StatusChart({ data }: { data: ChartDatum[] }) {
  const palette = useTokenColors(['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']);
  const [muted] = useTokenColors(['--muted-foreground']);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: muted, fontSize: 12 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: muted, fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
            color: 'hsl(var(--foreground))',
          }}
          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
