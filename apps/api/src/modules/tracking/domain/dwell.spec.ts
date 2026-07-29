import type { DriverPosition } from './driver-position';
import { dwellMinutesAtStop } from './dwell';

const PARADA = { latitude: 38.7223, longitude: -9.1393 };
/** ~1,1 km ao norte: bem fora do raio de 110 m. */
const LONGE = { latitude: 38.7323, longitude: -9.1393 };

const base = new Date('2026-07-29T10:00:00Z');

function pos(minuto: number, ponto: { latitude: number; longitude: number }): DriverPosition {
  return {
    id: `p-${minuto}`,
    tenantId: 't',
    driverId: 'u',
    latitude: ponto.latitude,
    longitude: ponto.longitude,
    recordedAt: new Date(base.getTime() + minuto * 60_000),
    speed: null,
    heading: null,
    status: 'en_route',
  };
}

describe('dwellMinutesAtStop (ADR-0088)', () => {
  // O defeito que motivou a mudança: o dwell do cliente contava desde o fim da
  // parada anterior, somando o deslocamento ao atendimento.
  it('mede só a permanência, não o deslocamento até a parada', () => {
    const trilha = [
      pos(0, LONGE), // saiu da parada anterior
      pos(5, LONGE), // a caminho
      pos(8, PARADA), // chegou
      pos(20, PARADA), // concluiu
    ];

    // 20 − 8 = 12 min de atendimento. O ciclo inteiro seriam 20.
    expect(dwellMinutesAtStop(trilha, PARADA)).toBe(12);
  });

  it('ignora passagem anterior pela mesma vizinhança', () => {
    const trilha = [
      pos(0, PARADA), // passou por perto de manhã
      pos(2, LONGE), // seguiu adiante
      pos(30, PARADA), // voltou para entregar
      pos(36, PARADA),
    ];

    expect(dwellMinutesAtStop(trilha, PARADA)).toBe(6);
  });

  // Sem sinal, sem afirmação. Zero entraria na mediana como um atendimento
  // instantâneo que nunca existiu.
  it('sem posição no raio devolve null, não zero', () => {
    expect(dwellMinutesAtStop([pos(0, LONGE), pos(10, LONGE)], PARADA)).toBeNull();
  });

  it('trilha vazia devolve null', () => {
    expect(dwellMinutesAtStop([], PARADA)).toBeNull();
  });

  it('uma única posição não tem intervalo a medir', () => {
    expect(dwellMinutesAtStop([pos(5, PARADA)], PARADA)).toBeNull();
  });

  it('motorista que ficou na parada a viagem toda conta desde a primeira', () => {
    const trilha = [pos(0, PARADA), pos(7, PARADA), pos(15, PARADA)];
    expect(dwellMinutesAtStop(trilha, PARADA)).toBe(15);
  });

  it('arredonda a uma casa decimal', () => {
    const trilha = [pos(0, LONGE), pos(1, PARADA), pos(2.55, PARADA)];
    expect(dwellMinutesAtStop(trilha, PARADA)).toBe(1.6);
  });
});
