import { errorMinutes, hourOfWeek, summarize } from './eta-observation';

const at = (iso: string): Date => new Date(iso);

describe('errorMinutes', () => {
  it('positivo quando chega depois do prometido', () => {
    expect(errorMinutes(at('2026-07-29T10:00:00Z'), at('2026-07-29T10:12:00Z'))).toBe(12);
  });

  it('negativo quando chega antes', () => {
    expect(errorMinutes(at('2026-07-29T10:00:00Z'), at('2026-07-29T09:53:00Z'))).toBe(-7);
  });

  // Entrega concluída sem plano vigente: há o real, não há o que medir. Zero
  // seria pior que nulo — entraria na média como um acerto que nunca houve.
  it('sem previsão, não há erro', () => {
    expect(errorMinutes(null, at('2026-07-29T10:00:00Z'))).toBeNull();
  });
});

describe('hourOfWeek', () => {
  it('distingue o mesmo horário em dias diferentes', () => {
    const terca = new Date(2026, 6, 28, 9, 30); // terça, 09:30 local
    const domingo = new Date(2026, 7, 2, 9, 30); // domingo, 09:30 local

    expect(hourOfWeek(terca)).not.toBe(hourOfWeek(domingo));
    expect(hourOfWeek(terca)).toBe(2 * 24 + 9);
    expect(hourOfWeek(domingo)).toBe(0 * 24 + 9);
  });

  it('cobre a semana inteira em 0..167', () => {
    const sabadoTarde = new Date(2026, 7, 1, 23, 59); // sábado 23h
    expect(hourOfWeek(sabadoTarde)).toBe(6 * 24 + 23);
  });
});

describe('summarize', () => {
  it('sem amostra, não inventa número', () => {
    expect(summarize([])).toEqual({
      samples: 0,
      maeMinutes: null,
      biasMinutes: null,
      p90Minutes: null,
      withoutPrediction: 0,
    });
  });

  it('MAE usa o valor absoluto', () => {
    const s = summarize([10, -10, 10, -10]);
    expect(s.maeMinutes).toBe(10);
  });

  // A distinção que justifica guardar o sinal: os dois conjuntos abaixo têm o
  // mesmo MAE, mas um atrasa sempre e o outro apenas oscila.
  it('viés separa "atrasa sempre" de "oscila"', () => {
    const sempreAtrasa = summarize([10, 10, 10, 10]);
    const oscila = summarize([10, -10, 10, -10]);

    expect(sempreAtrasa.maeMinutes).toBe(oscila.maeMinutes);
    expect(sempreAtrasa.biasMinutes).toBe(10);
    expect(oscila.biasMinutes).toBe(0);
  });

  it('p90 mostra a cauda que o cliente sente', () => {
    // 1..10: o p90 fica entre o 9º e o 10º valor.
    const s = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
    expect(s.maeMinutes).toBe(14.5);
    expect(s.p90Minutes).toBe(18.1);
  });

  it('amostra única não quebra o percentil', () => {
    expect(summarize([7])).toMatchObject({ samples: 1, maeMinutes: 7, p90Minutes: 7 });
  });

  // Medições sem previsão são contadas à parte, e não como acerto.
  it('separa medições sem previsão da média', () => {
    const s = summarize([10, null, null, 20]);

    expect(s.samples).toBe(2);
    expect(s.maeMinutes).toBe(15);
    expect(s.withoutPrediction).toBe(2);
  });
});
