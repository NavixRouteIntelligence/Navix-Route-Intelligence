import { operationalDayOf } from './route-plan';

/**
 * O dia operacional é o dia de **quem opera** (ADR-0105). Em UTC — o padrão —
 * o resultado é o de sempre; com fuso configurado, deixa de jogar a rota da
 * noite para o dia seguinte.
 */
describe('operationalDayOf', () => {
  it('sem fuso informado, permanece em UTC (comportamento anterior)', () => {
    expect(operationalDayOf(new Date('2026-08-03T23:30:00.000Z'))).toBe('2026-08-03');
  });

  // 21h em São Paulo é 00h do dia seguinte em UTC. Sem fuso, a rota da noite
  // nascia com o dia de amanhã e sumia da tela do motorista naquela noite.
  it('rota da noite em São Paulo continua sendo do dia de hoje', () => {
    const vinteEUmaEmSP = new Date('2026-08-04T00:00:00.000Z');

    expect(operationalDayOf(vinteEUmaEmSP, 'America/Sao_Paulo')).toBe('2026-08-03');
    expect(operationalDayOf(vinteEUmaEmSP, 'UTC')).toBe('2026-08-04');
  });

  // E o sentido oposto: madrugada em Lisboa (UTC+1 no verão) já é o dia novo.
  it('madrugada em Lisboa pertence ao dia local, não ao anterior', () => {
    const meiaNoiteEMeiaEmLisboa = new Date('2026-08-03T23:30:00.000Z');

    expect(operationalDayOf(meiaNoiteEMeiaEmLisboa, 'Europe/Lisbon')).toBe('2026-08-04');
  });

  it('formata com zero à esquerda', () => {
    expect(operationalDayOf(new Date('2026-01-05T12:00:00.000Z'), 'UTC')).toBe('2026-01-05');
  });
});
