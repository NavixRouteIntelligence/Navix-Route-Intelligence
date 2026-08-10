import {
  MAX_COORDS_BY_PROFILE,
  TRAFFIC_HORIZON_MINUTES,
  chooseMatrixProfile,
} from './matrix-profile';

const AGORA = new Date('2026-08-09T09:00:00Z');

function escolher(over: Partial<Parameters<typeof chooseMatrixProfile>[0]> = {}) {
  return chooseMatrixProfile({ base: 'driving', points: 8, now: AGORA, ...over });
}

describe('chooseMatrixProfile', () => {
  it('partindo agora e cabendo no limite, usa trânsito', () => {
    expect(escolher({ departureAt: AGORA })).toEqual({
      profile: 'driving-traffic',
      reason: 'traffic-window',
    });
  });

  // Trânsito é uma leitura do instante. Aplicá-lo a uma rota de amanhã não é
  // mais preciso — é ruído com aparência de precisão.
  it('rota para daqui a horas não leva trânsito', () => {
    const tarde = new Date(AGORA.getTime() + 6 * 3600_000);

    expect(escolher({ departureAt: tarde }).reason).toBe('not-departing-now');
  });

  it(`${TRAFFIC_HORIZON_MINUTES} minutos ainda conta como agora`, () => {
    const daqui = new Date(AGORA.getTime() + TRAFFIC_HORIZON_MINUTES * 60_000);

    expect(escolher({ departureAt: daqui }).profile).toBe('driving-traffic');
  });

  it('um minuto além do horizonte já não conta', () => {
    const daqui = new Date(AGORA.getTime() + (TRAFFIC_HORIZON_MINUTES + 1) * 60_000);

    expect(escolher({ departureAt: daqui }).profile).toBe('driving');
  });

  // Não saber quando parte é tratado como «não é agora»: assumir o contrário
  // faria toda rota sem horário receber o trânsito do momento do cálculo.
  it('sem horário de partida, não usa trânsito', () => {
    expect(escolher({ departureAt: null }).reason).toBe('not-departing-now');
    expect(escolher({}).reason).toBe('not-departing-now');
  });

  // `driving-traffic` aceita 10 coordenadas contra 25 do `driving`.
  it('acima de 10 pontos volta ao driving, mesmo partindo agora', () => {
    const r = escolher({ departureAt: AGORA, points: 11 });

    expect(r).toEqual({ profile: 'driving', reason: 'too-many-points' });
  });

  it('exatamente 10 ainda cabe', () => {
    expect(escolher({ departureAt: AGORA, points: 10 }).profile).toBe('driving-traffic');
  });

  it('só o carro tem variante com trânsito', () => {
    for (const base of ['cycling', 'walking'] as const) {
      expect(chooseMatrixProfile({ base, points: 4, departureAt: AGORA, now: AGORA })).toEqual({
        profile: base,
        reason: 'not-driving',
      });
    }
  });

  it('os limites por perfil são os do provedor', () => {
    expect(MAX_COORDS_BY_PROFILE.driving).toBe(25);
    expect(MAX_COORDS_BY_PROFILE['driving-traffic']).toBe(10);
  });
});
