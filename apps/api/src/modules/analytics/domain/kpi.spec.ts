import { summarizeKpis, type KpiDailyRow } from './kpi';

function dia(over: Partial<KpiDailyRow> = {}): KpiDailyRow {
  return {
    day: '2026-07-30',
    plans: 0,
    savedKm: 0,
    savedMinutes: 0,
    optimizedKm: 0,
    baselineKm: 0,
    scoreSum: 0,
    delivered: 0,
    failed: 0,
    canceled: 0,
    onTime: 0,
    expense: 0,
    ...over,
  };
}

const PERIODO = { from: '2026-07-01', to: '2026-07-31' };

describe('summarizeKpis', () => {
  it('soma o período inteiro, não uma página', () => {
    const resumo = summarizeKpis(
      [dia({ savedKm: 12.5, plans: 2 }), dia({ day: '2026-07-31', savedKm: 7.5, plans: 3 })],
      PERIODO.from,
      PERIODO.to,
    );

    expect(resumo.savedKm).toBe(20);
  });

  it('agrega economia de tempo e calcula ganho de distância pela baseline inteira', () => {
    const resumo = summarizeKpis(
      [
        dia({ savedKm: 10, savedMinutes: 20, baselineKm: 100 }),
        dia({ day: '2026-07-31', savedKm: 5, savedMinutes: 15, baselineKm: 50 }),
      ],
      PERIODO.from,
      PERIODO.to,
    );

    expect(resumo.savedMinutes).toBe(35);
    expect(resumo.distanceSavingsRate).toBe(0.1);
  });

  it('taxa de sucesso é entregues sobre finalizadas', () => {
    const resumo = summarizeKpis(
      [dia({ delivered: 8, failed: 1, canceled: 1 })],
      PERIODO.from,
      PERIODO.to,
    );

    expect(resumo.finished).toBe(10);
    expect(resumo.successRate).toBe(0.8);
  });

  // Uma entrega que falhou não é "fora do prazo", é outra coisa: o denominador
  // do on-time são as concluídas.
  it('on-time usa apenas as entregues como denominador', () => {
    const resumo = summarizeKpis(
      [dia({ delivered: 10, failed: 5, onTime: 9 })],
      PERIODO.from,
      PERIODO.to,
    );

    expect(resumo.onTimeRate).toBe(0.9);
  });

  it('custo por entrega divide a despesa pelas concluídas', () => {
    const resumo = summarizeKpis([dia({ delivered: 4, expense: 100 })], PERIODO.from, PERIODO.to);

    expect(resumo.costPerDelivery).toBe(25);
  });

  // Zero seria mentira: "0% de sucesso" e "ainda não houve entrega" são estados
  // diferentes, e só o segundo é verdade num tenant que começou hoje.
  it('sem denominador devolve null, não zero', () => {
    const resumo = summarizeKpis([dia()], PERIODO.from, PERIODO.to);

    expect(resumo.successRate).toBeNull();
    expect(resumo.onTimeRate).toBeNull();
    expect(resumo.costPerDelivery).toBeNull();
    expect(resumo.averageScore).toBeNull();
    expect(resumo.distanceSavingsRate).toBeNull();
  });

  it('período sem nenhum dia não quebra', () => {
    const resumo = summarizeKpis([], PERIODO.from, PERIODO.to);

    expect(resumo).toMatchObject({ savedKm: 0, delivered: 0, finished: 0, series: [] });
  });

  // A média das médias diárias daria peso igual a um dia com 1 rota e outro
  // com 50.
  it('score médio é ponderado pelo nº de planos', () => {
    const resumo = summarizeKpis(
      [
        dia({ plans: 1, scoreSum: 100 }), // um dia com 1 rota de score 100
        dia({ day: '2026-07-31', plans: 9, scoreSum: 450 }), // nove de score 50
      ],
      PERIODO.from,
      PERIODO.to,
    );

    // Ponderado: 550 / 10 = 55. A média das médias daria 75.
    expect(resumo.averageScore).toBe(55);
  });

  it('a série preserva os dias para o gráfico, com as taxas de cada um', () => {
    const resumo = summarizeKpis(
      [
        dia({ day: '2026-07-30', delivered: 4, failed: 1, onTime: 2, savedKm: 3 }),
        dia({ day: '2026-07-31', delivered: 10, onTime: 10 }),
      ],
      PERIODO.from,
      PERIODO.to,
    );

    expect(resumo.series).toHaveLength(2);
    expect(resumo.series[0]).toMatchObject({
      day: '2026-07-30',
      successRate: 0.8,
      onTimeRate: 0.5,
    });
    expect(resumo.series[1]).toMatchObject({ onTimeRate: 1 });
  });
});
