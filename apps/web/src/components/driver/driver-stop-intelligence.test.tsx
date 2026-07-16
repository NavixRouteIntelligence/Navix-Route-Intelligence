import type { CollectiveInsightView, LoadPlanView } from '@navix/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { DriverStopIntelligence } from './driver-stop-intelligence';

function wrap(ui: React.ReactNode) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

const insight: CollectiveInsightView = {
  cell: '-23.550,-46.630',
  sampleSize: 5,
  parking: { difficulty: 'hard', confidence: 0.8 },
  accessTips: [],
};

const loadPlan: LoadPlanView = {
  placements: [
    { id: 'b', loadOrder: 1, deliverySequence: 2, zone: 'front', weightKg: 0, volumeM3: 0, fragile: false },
    { id: 'a', loadOrder: 2, deliverySequence: 1, zone: 'door', weightKg: 0, volumeM3: 0, fragile: false },
  ],
  totalWeightKg: 0,
  totalVolumeM3: 0,
  capacityKg: null,
  capacityVolumeM3: null,
  weightUtilization: null,
  volumeUtilization: null,
  overCapacity: false,
  warnings: [],
};

describe('DriverStopIntelligence', () => {
  it('mostra estacionamento previsto, insight coletivo e plano de carga', () => {
    wrap(
      <DriverStopIntelligence
        parking={{ difficulty: 'moderate', confidence: 0.65, walkMinutes: 3 }}
        insight={insight}
        loadPlan={loadPlan}
      />,
    );
    expect(screen.getByText('Moderado')).toBeInTheDocument();
    expect(screen.getByText(/5 observações/)).toBeInTheDocument();
    expect(screen.getByText('Organização da carga')).toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há sinais', () => {
    wrap(<DriverStopIntelligence />);
    expect(screen.getByText(/Sem sinais para esta parada/)).toBeInTheDocument();
  });

  it('mostra o título mas oculta o estado vazio enquanto carrega', () => {
    wrap(<DriverStopIntelligence loading />);
    expect(screen.getByText('Inteligência da parada')).toBeInTheDocument();
    expect(screen.queryByText(/Sem sinais para esta parada/)).not.toBeInTheDocument();
  });
});
