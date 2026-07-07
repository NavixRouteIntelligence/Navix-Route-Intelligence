'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Package, Route, Search, Truck, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { deliveriesApi } from '@/lib/api/deliveries';
import { fleetApi } from '@/lib/api/fleet';

const QUICK = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/deliveries', label: 'Entregas', icon: Package },
  { href: '/fleet/drivers', label: 'Motoristas', icon: Users },
  { href: '/fleet/vehicles', label: 'Veículos', icon: Truck },
  { href: '/optimizer', label: 'Otimizador', icon: Route },
];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const deliveries = useQuery({ queryKey: ['search', 'deliveries'], queryFn: () => deliveriesApi.list({ pageSize: 100 }), enabled: open });
  const vehicles = useQuery({ queryKey: ['search', 'vehicles'], queryFn: () => fleetApi.listVehicles({ pageSize: 100 }), enabled: open });
  const drivers = useQuery({ queryKey: ['search', 'drivers'], queryFn: () => fleetApi.listDrivers({ pageSize: 100 }), enabled: open });

  const term = q.trim().toLowerCase();
  const quick = QUICK.filter((i) => i.label.toLowerCase().includes(term));
  const matched = useMemo(() => {
    if (!term) return { deliveries: [], vehicles: [], drivers: [] };
    return {
      deliveries: (deliveries.data?.data ?? []).filter((d) => `${d.address.city} ${d.address.street}`.toLowerCase().includes(term)).slice(0, 5),
      vehicles: (vehicles.data?.data ?? []).filter((v) => v.plate.toLowerCase().includes(term)).slice(0, 5),
      drivers: (drivers.data?.data ?? []).filter((d) => d.name.toLowerCase().includes(term)).slice(0, 5),
    };
  }, [term, deliveries.data, vehicles.data, drivers.data]);

  function go(href: string) {
    setOpen(false);
    setQ('');
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted md:w-64"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Buscar…</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 text-xs md:inline">⌘K</kbd>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content className="fixed left-1/2 top-24 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-elevated data-[state=open]:animate-fade-in">
            <DialogPrimitive.Title className="sr-only">Busca global</DialogPrimitive.Title>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar entregas, veículos, motoristas…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              <Group label="Ir para">
                {quick.map((i) => (
                  <Item key={i.href} onClick={() => go(i.href)} icon={<i.icon className="h-4 w-4" />} label={i.label} />
                ))}
              </Group>
              {matched.deliveries.length > 0 && (
                <Group label="Entregas">
                  {matched.deliveries.map((d) => (
                    <Item key={d.id} onClick={() => go(`/deliveries/${d.id}/edit`)} icon={<Package className="h-4 w-4" />} label={`${d.address.city} · ${d.address.street}`} />
                  ))}
                </Group>
              )}
              {matched.vehicles.length > 0 && (
                <Group label="Veículos">
                  {matched.vehicles.map((v) => (
                    <Item key={v.id} onClick={() => go('/fleet/vehicles')} icon={<Truck className="h-4 w-4" />} label={v.plate} />
                  ))}
                </Group>
              )}
              {matched.drivers.length > 0 && (
                <Group label="Motoristas">
                  {matched.drivers.map((d) => (
                    <Item key={d.id} onClick={() => go('/fleet/drivers')} icon={<Users className="h-4 w-4" />} label={d.name} />
                  ))}
                </Group>
              )}
              {term && quick.length === 0 && matched.deliveries.length === 0 && matched.vehicles.length === 0 && matched.drivers.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nada encontrado para “{q}”.</p>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Item({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted')}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
