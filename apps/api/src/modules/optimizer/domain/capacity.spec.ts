import { assessCapacity, totalDemand } from './capacity';

describe('capacity', () => {
  it('soma a demanda das paradas', () => {
    const total = totalDemand([
      { weightKg: 10, volumeM3: 0.5 },
      { weightKg: 5, volumeM3: 0.2 },
    ]);
    expect(total).toEqual({ weightKg: 15, volumeM3: 0.7 });
  });

  it('sem capacidade (null): sempre viável', () => {
    const usage = assessCapacity({ weightKg: 9999, volumeM3: 99 }, null);
    expect(usage.feasible).toBe(true);
    expect(usage.capacityKg).toBeNull();
    expect(usage.overWeightKg).toBe(0);
  });

  it('dentro da capacidade: viável', () => {
    const usage = assessCapacity({ weightKg: 100, volumeM3: 1 }, { weightKg: 400, volumeM3: 1.5 });
    expect(usage.feasible).toBe(true);
  });

  it('excede uma dimensão: inviável com o excedente calculado', () => {
    const usage = assessCapacity({ weightKg: 500, volumeM3: 1 }, { weightKg: 400, volumeM3: 1.5 });
    expect(usage.feasible).toBe(false);
    expect(usage.overWeightKg).toBe(100);
    expect(usage.overVolumeM3).toBe(0);
  });
});
