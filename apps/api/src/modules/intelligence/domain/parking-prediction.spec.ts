import { predictParkingFromTraffic } from './parking-prediction';

describe('predictParkingFromTraffic', () => {
  it('trânsito livre → estacionar fácil', () => {
    const p = predictParkingFromTraffic(1.0);
    expect(p.difficulty).toBe('easy');
    expect(p.confidence).toBeGreaterThan(0);
    expect(p.walkMinutes).toBeGreaterThan(0);
  });

  it('trânsito moderado → dificuldade moderada', () => {
    expect(predictParkingFromTraffic(1.2).difficulty).toBe('moderate');
  });

  it('trânsito de pico → estacionar difícil (mais caminhada)', () => {
    const easy = predictParkingFromTraffic(1.0);
    const hard = predictParkingFromTraffic(1.5);
    expect(hard.difficulty).toBe('hard');
    expect(hard.walkMinutes).toBeGreaterThan(easy.walkMinutes);
  });
});
