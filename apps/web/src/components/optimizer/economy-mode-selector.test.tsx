import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { EconomyModeSelector } from './economy-mode-selector';

function renderSelector(props: Parameters<typeof EconomyModeSelector>[0]) {
  return render(
    <LocaleProvider>
      <EconomyModeSelector {...props} />
    </LocaleProvider>,
  );
}

describe('EconomyModeSelector', () => {
  it('mostra os modos e marca o ativo (pt-BR)', () => {
    renderSelector({ value: 'time', onChange: () => {} });
    expect(screen.getByRole('radio', { name: /Tempo/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Combustível/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Pedágios/ })).toBeInTheDocument();
  });

  it('emite o modo escolhido ao clicar', () => {
    const onChange = vi.fn();
    renderSelector({ onChange });
    fireEvent.click(screen.getByRole('radio', { name: /Pedágios/ }));
    expect(onChange).toHaveBeenCalledWith('tolls');
  });

  it('"Balanceado" limpa o modo (undefined)', () => {
    const onChange = vi.fn();
    renderSelector({ value: 'co2', onChange });
    fireEvent.click(screen.getByRole('radio', { name: /Balanceado/ }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
