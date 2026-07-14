import { classifyTraffic, TimeContextTrafficModel } from './traffic-model';

/** Data local determinística com dia da semana e hora desejados. */
function dateAt(weekday: number, hour: number): Date {
  const d = new Date(2026, 6, 1, hour, 0, 0, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const POINT = { latitude: -23.5, longitude: -46.6 };

describe('TimeContextTrafficModel', () => {
  const model = new TimeContextTrafficModel();

  it('dia útil no pico da manhã: fator alto (peak)', () => {
    const f = model.factor(POINT, dateAt(1, 8)); // segunda 08h
    expect(f).toBeGreaterThan(1.35);
    expect(classifyTraffic(f)).toBe('peak');
  });

  it('dia útil de madrugada: fluxo livre', () => {
    const f = model.factor(POINT, dateAt(1, 3)); // segunda 03h
    expect(f).toBe(1);
    expect(classifyTraffic(f)).toBe('off_peak');
  });

  it('fim de semana à tarde: moderado', () => {
    const f = model.factor(POINT, dateAt(6, 15)); // sábado 15h
    expect(classifyTraffic(f)).toBe('moderate');
  });

  it('pico é mais lento que a madrugada no mesmo dia', () => {
    expect(model.factor(POINT, dateAt(3, 18))).toBeGreaterThan(model.factor(POINT, dateAt(3, 2)));
  });
});

describe('classifyTraffic', () => {
  it('mapeia fatores para janelas', () => {
    expect(classifyTraffic(1.0)).toBe('off_peak');
    expect(classifyTraffic(1.2)).toBe('moderate');
    expect(classifyTraffic(1.5)).toBe('peak');
  });
});
