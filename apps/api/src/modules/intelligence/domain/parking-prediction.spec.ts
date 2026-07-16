import { blendParking, predictParkingFromTraffic } from './parking-prediction';

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

describe('blendParking (realimentação coletiva)', () => {
  const heuristicEasy = predictParkingFromTraffic(1.0); // easy

  it('sem observação da comunidade devolve a heurística intacta', () => {
    expect(blendParking(heuristicEasy)).toEqual(heuristicEasy);
  });

  it('a observação da comunidade (confiante) puxa a dificuldade e eleva a confiança', () => {
    const blended = blendParking(heuristicEasy, { difficulty: 'hard', confidence: 0.8 });
    expect(blended.difficulty).toBe('hard');
    expect(blended.confidence).toBeGreaterThan(heuristicEasy.confidence);
    expect(blended.walkMinutes).toBe(5);
  });

  it('observação fraca move pouco em relação à heurística', () => {
    const blended = blendParking(heuristicEasy, { difficulty: 'hard', confidence: 0.1 });
    expect(blended.difficulty).toBe('easy');
  });
});
