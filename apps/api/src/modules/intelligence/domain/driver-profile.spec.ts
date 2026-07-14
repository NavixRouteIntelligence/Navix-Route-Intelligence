import { learnDriverProfile, NEUTRAL_DRIVER_PROFILE, type DriverSample } from './driver-profile';

const sample = (speedKmh: number, serviceMinutes: number, onTime: boolean): DriverSample => ({
  speedKmh,
  serviceMinutes,
  onTime,
});

describe('learnDriverProfile', () => {
  it('poucas amostras: mantém o perfil neutro', () => {
    expect(learnDriverProfile([sample(60, 4, true)], 30)).toEqual(NEUTRAL_DRIVER_PROFILE);
  });

  it('aprende speedFactor, tempo de serviço e pontualidade das médias', () => {
    const samples = [sample(45, 6, true), sample(45, 8, true), sample(45, 4, false), sample(45, 6, true)];
    const p = learnDriverProfile(samples, 30);
    expect(p.speedFactor).toBeCloseTo(1.5); // 45/30
    expect(p.serviceTimeMinutes).toBeCloseTo(6); // média (6+8+4+6)/4
    expect(p.punctuality).toBeCloseTo(0.75); // 3/4 no prazo
  });

  it('limita o speedFactor para não extrapolar em dados ruidosos', () => {
    const fast = learnDriverProfile(Array(5).fill(sample(200, 5, true)), 30);
    expect(fast.speedFactor).toBe(1.8); // teto
    const slow = learnDriverProfile(Array(5).fill(sample(5, 5, true)), 30);
    expect(slow.speedFactor).toBe(0.5); // piso
  });
});
