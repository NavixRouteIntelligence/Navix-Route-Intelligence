import type { DriverPerformanceView } from '@navix/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/locale-provider';

const myPerformance = vi.fn();
vi.mock('@/lib/api/analytics', () => ({ analyticsApi: { myPerformance: () => myPerformance() } }));

const { DriverPerformanceCard } = await import('./driver-performance-card');

function view(over: Partial<DriverPerformanceView> = {}): DriverPerformanceView {
  return {
    from: '2026-07-04',
    to: '2026-08-02',
    delivered: 120,
    workedDays: 20,
    successRate: 0.96,
    onTimeRate: 0.82,
    streak: { days: 5, current: true },
    goal: null,
    restAdvice: null,
    ...over,
  };
}

async function renderCard(data: DriverPerformanceView) {
  myPerformance.mockResolvedValue({ data });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LocaleProvider>
        <DriverPerformanceCard />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  await screen.findByText('Meu desempenho');
}

describe('DriverPerformanceCard', () => {
  it('mostra o consolidado do período', async () => {
    await renderCard(view());

    expect(await screen.findByText('120')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
  });

  // O critério da sequência tem que estar visível: um contador cujo critério
  // ninguém entende é o que faz alguém trabalhar doente por medo de perdê-lo.
  it('a sequência declara que folga não a quebra', async () => {
    await renderCard(view());

    expect(await screen.findByText(/5 dias seguidos sem falha/)).toBeInTheDocument();
    expect(screen.getByText(/Dias de folga não quebram a sequência/)).toBeInTheDocument();
  });

  it('a meta é acessível a leitor de tela', async () => {
    await renderCard(view({ goal: { target: 0.95, current: 0.96, met: true } }));

    const barra = await screen.findByRole('progressbar');
    expect(barra).toHaveAttribute('aria-valuenow', '96');
    expect(barra).toHaveAttribute('aria-valuetext', '96% de 95%');
    expect(screen.getByText(/Agora é manter, não superar/)).toBeInTheDocument();
  });

  it('sugere pausa no dia longo, como aviso e não como alerta', async () => {
    await renderCard(view({ restAdvice: { activeMinutes: 320, longDay: true } }));

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent(/5h hoje/);
    expect(aviso).toHaveTextContent(/Nada aqui melhora se você dirigir cansado/);
  });

  it('não sugere pausa em dia curto', async () => {
    await renderCard(view({ restAdvice: { activeMinutes: 120, longDay: false } }));

    await screen.findByText('120');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // A ausência é o requisito: nenhum texto do card compara com outro motorista.
  it('não exibe posição, ranking nem média da frota', async () => {
    const { container } = { container: document.body };
    await renderCard(view({ goal: { target: 0.9, current: 0.96, met: true } }));

    const texto = container.textContent?.toLowerCase() ?? '';
    for (const proibido of ['ranking', 'posição', 'média da frota', 'colegas', 'por hora']) {
      expect(texto).not.toContain(proibido);
    }
  });

  it('período sem dias trabalhados não inventa números', async () => {
    await renderCard(view({ delivered: 0, workedDays: 0, successRate: null, onTimeRate: null }));

    expect(await screen.findByText(/Ainda sem dias trabalhados/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
