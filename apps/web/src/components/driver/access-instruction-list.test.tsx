import type { AccessInstructionView } from '@navix/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { AccessInstructionList } from './access-instruction-list';

function renderList(instructions: AccessInstructionView[]) {
  return render(
    <LocaleProvider>
      <AccessInstructionList instructions={instructions} />
    </LocaleProvider>,
  );
}

describe('AccessInstructionList', () => {
  it('não renderiza nada quando vazio', () => {
    const { container } = renderList([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra os rótulos por tipo e os textos (pt-BR)', () => {
    renderList([
      { kind: 'dock', text: 'Entrar pela doca dos fundos' },
      { kind: 'intercom', text: 'interfone 12' },
    ]);
    expect(screen.getByText('Doca:')).toBeInTheDocument();
    expect(screen.getByText('Entrar pela doca dos fundos')).toBeInTheDocument();
    expect(screen.getByText('Interfone:')).toBeInTheDocument();
  });
});
