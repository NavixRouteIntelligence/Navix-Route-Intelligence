import type { FleetDistribution as FleetDistributionData } from '@navix/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { optimizerApi } from '@/lib/api/optimizer';

import { FleetDistribution } from './fleet-distribution';

vi.mock('@/lib/api/optimizer', () => ({
  optimizerApi: { fleetDistribution: vi.fn() },
}));

function wrap(data: FleetDistributionData) {
  vi.mocked(optimizerApi.fleetDistribution).mockResolvedValue({ data });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FleetDistribution />
    </QueryClientProvider>,
  );
}

const ana = {
  driverId: 'ficha-a',
  driverName: 'Ana Souza',
  pending: 3,
  inRoute: 2,
  routePlanId: 'plano-1',
  stops: 5,
  distanceKm: 23.4,
};

describe('FleetDistribution (ADR-0101)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra a carga e a rota de cada motorista', async () => {
    wrap({ drivers: [ana], unassigned: 0 });

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/3 pendente/)).toBeInTheDocument();
    expect(screen.getByText(/2 em rota/)).toBeInTheDocument();
    expect(screen.getByText(/5 paradas · 23,4 km/)).toBeInTheDocument();
  });

  it('mostra o motorista ocioso em vez de escondê-lo', async () => {
    wrap({
      drivers: [
        ana,
        {
          driverId: 'ficha-c',
          driverName: 'Carla Dias',
          pending: 0,
          inRoute: 0,
          routePlanId: null,
          stops: null,
          distanceKm: null,
        },
      ],
      unassigned: 0,
    });

    expect(await screen.findByText('Carla Dias')).toBeInTheDocument();
    expect(screen.getByText('sem entregas')).toBeInTheDocument();
  });

  it('destaca o que ainda não tem motorista, com atalho para as entregas', async () => {
    wrap({ drivers: [ana], unassigned: 7 });

    const atalho = await screen.findByRole('link', { name: /7 sem motorista/ });
    expect(atalho).toHaveAttribute('href', '/deliveries');
  });

  it('não mostra o alerta quando tudo tem dono', async () => {
    wrap({ drivers: [ana], unassigned: 0 });

    await screen.findByText('Ana Souza');
    expect(screen.queryByText(/sem motorista/)).not.toBeInTheDocument();
  });

  it('quem tem carga mas ainda não tem rota aparece como "rota não preparada"', async () => {
    wrap({
      drivers: [{ ...ana, pending: 1, inRoute: 0, routePlanId: null, stops: null, distanceKm: null }],
      unassigned: 0,
    });

    expect(await screen.findByText(/rota não preparada/)).toBeInTheDocument();
  });

  it('frota sem motorista ativo explica o que fazer', async () => {
    wrap({ drivers: [], unassigned: 4 });

    expect(await screen.findByText('Nenhum motorista ativo')).toBeInTheDocument();
  });
});
