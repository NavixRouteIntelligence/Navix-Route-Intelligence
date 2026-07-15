import type { CollectiveInsightView } from '@navix/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { CollectiveInsightCard } from './collective-insight-card';

function renderCard(insight: CollectiveInsightView) {
  return render(
    <LocaleProvider>
      <CollectiveInsightCard insight={insight} />
    </LocaleProvider>,
  );
}

describe('CollectiveInsightCard', () => {
  it('mostra estacionamento, atendimento e dicas (pt-BR)', () => {
    renderCard({
      cell: '-23.550,-46.630',
      sampleSize: 7,
      parking: { difficulty: 'hard', confidence: 0.8 },
      typicalServiceMinutes: 6,
      accessTips: ['Doca dos fundos'],
    });
    expect(screen.getByText('Difícil')).toBeInTheDocument();
    expect(screen.getByText(/6 min/)).toBeInTheDocument();
    expect(screen.getByText(/Doca dos fundos/)).toBeInTheDocument();
    expect(screen.getByText(/7 observações/)).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há sinal suficiente', () => {
    renderCard({ cell: '0.000,0.000', sampleSize: 1, accessTips: [] });
    expect(screen.getByText(/Ainda sem observações suficientes/)).toBeInTheDocument();
  });
});
