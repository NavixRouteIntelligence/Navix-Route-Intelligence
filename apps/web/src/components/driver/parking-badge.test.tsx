import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { ParkingBadge } from './parking-badge';

function renderBadge(difficulty: 'easy' | 'moderate' | 'hard', walkMinutes = 3) {
  return render(
    <LocaleProvider>
      <ParkingBadge prediction={{ difficulty, confidence: 0.7, walkMinutes }} />
    </LocaleProvider>,
  );
}

describe('ParkingBadge', () => {
  it('mostra a dificuldade e a caminhada (pt-BR)', () => {
    renderBadge('hard', 5);
    expect(screen.getByText('Difícil')).toBeInTheDocument();
    expect(screen.getByText(/5 min a pé/)).toBeInTheDocument();
  });

  it('rotula fácil/moderado', () => {
    renderBadge('easy');
    expect(screen.getByText('Fácil')).toBeInTheDocument();
  });
});
