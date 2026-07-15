import type { LoadPlanView } from '@navix/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { LoadPlanList } from './load-plan-list';

const plan: LoadPlanView = {
  placements: [
    { id: 'b', label: 'Cliente B', loadOrder: 1, deliverySequence: 2, zone: 'front', weightKg: 200, volumeM3: 2, fragile: true },
    { id: 'a', label: 'Cliente A', loadOrder: 2, deliverySequence: 1, zone: 'door', weightKg: 100, volumeM3: 1, fragile: false },
  ],
  totalWeightKg: 300,
  totalVolumeM3: 3,
  capacityKg: 1200,
  capacityVolumeM3: 8,
  weightUtilization: 0.25,
  volumeUtilization: 0.375,
  overCapacity: false,
  warnings: ['fragile_under_load'],
};

function renderPlan(p: LoadPlanView = plan) {
  return render(
    <LocaleProvider>
      <LoadPlanList plan={p} />
    </LocaleProvider>,
  );
}

describe('LoadPlanList', () => {
  it('lista os itens na ordem de carregamento (LIFO)', () => {
    renderPlan();
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Cliente B');
    expect(items[1]).toHaveTextContent('Cliente A');
  });

  it('mostra ocupação e traduz avisos (pt-BR)', () => {
    renderPlan();
    expect(screen.getByText(/Peso 25%/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/frágil/i);
  });

  it('marca item frágil', () => {
    renderPlan();
    expect(screen.getByText('Frágil')).toBeInTheDocument();
  });
});
