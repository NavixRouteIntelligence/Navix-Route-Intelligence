import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeliveryStatusBadge, PriorityBadge } from './status-badge';

describe('StatusBadge', () => {
  it('mapeia o status da entrega para o rótulo pt-BR', () => {
    render(<DeliveryStatusBadge status="in_route" />);
    expect(screen.getByText('Em rota')).toBeInTheDocument();
  });

  it('mapeia a prioridade para o rótulo', () => {
    render(<PriorityBadge priority="urgent" />);
    expect(screen.getByText('Urgente')).toBeInTheDocument();
  });
});
