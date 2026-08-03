import { arriveAt } from './time-window-clock';

const janela = (startMinutes: number, endMinutes: number) => ({ startMinutes, endMinutes });

describe('arriveAt', () => {
  // Os três casos que a NAV-4.5 exige, no núcleo onde a regra vive.
  it('chegada antecipada: espera até a abertura, e o serviço começa lá', () => {
    const a = arriveAt(30, janela(90, 180));

    expect(a.waitMinutes).toBe(60);
    expect(a.serviceStartMinutes).toBe(90);
    // Esperar não é atraso: a entrega acontece dentro do combinado.
    expect(a.late).toBe(false);
  });

  it('chegada dentro da janela: sem espera e sem atraso', () => {
    const a = arriveAt(120, janela(90, 180));

    expect(a.waitMinutes).toBe(0);
    expect(a.serviceStartMinutes).toBe(120);
    expect(a.late).toBe(false);
  });

  it('chegada após o limite: atraso sinalizado, sem ajuste', () => {
    const a = arriveAt(200, janela(90, 180));

    expect(a.waitMinutes).toBe(0);
    // O relógio não é "corrigido" para dentro da janela: a parada segue na
    // rota, atrasada, e quem despacha vê.
    expect(a.serviceStartMinutes).toBe(200);
    expect(a.late).toBe(true);
  });

  it('exatamente na abertura e exatamente no fim contam como dentro', () => {
    expect(arriveAt(90, janela(90, 180))).toMatchObject({ waitMinutes: 0, late: false });
    expect(arriveAt(180, janela(90, 180))).toMatchObject({ late: false });
  });

  it('sem janela, o relógio não muda', () => {
    expect(arriveAt(42, null)).toEqual({
      serviceStartMinutes: 42,
      waitMinutes: 0,
      late: false,
    });
  });
});
