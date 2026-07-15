import { planLoad } from './load-planner';

describe('planLoad', () => {
  it('carrega em LIFO: a última entrega vai ao fundo (loadOrder 1)', () => {
    const plan = planLoad({
      items: [
        { id: 'a', sequence: 1, weightKg: 10 },
        { id: 'b', sequence: 2, weightKg: 20 },
        { id: 'c', sequence: 3, weightKg: 30 },
      ],
    });
    // Ordem de carregamento: c (última entrega) primeiro, a (primeira entrega) por último.
    expect(plan.placements.map((p) => p.id)).toEqual(['c', 'b', 'a']);
    expect(plan.placements[0]).toMatchObject({ id: 'c', loadOrder: 1, zone: 'front' });
    expect(plan.placements[2]).toMatchObject({ id: 'a', loadOrder: 3, zone: 'door' });
  });

  it('normaliza sequência fora de ordem antes de planejar', () => {
    const plan = planLoad({
      items: [
        { id: 'c', sequence: 3 },
        { id: 'a', sequence: 1 },
        { id: 'b', sequence: 2 },
      ],
    });
    expect(plan.placements.map((p) => p.deliverySequence)).toEqual([3, 2, 1]);
  });

  it('soma peso/volume e calcula ocupação com capacidade explícita', () => {
    const plan = planLoad({
      items: [
        { id: 'a', sequence: 1, weightKg: 100, volumeM3: 1 },
        { id: 'b', sequence: 2, weightKg: 300, volumeM3: 3 },
      ],
      capacityKg: 800,
      capacityVolumeM3: 8,
    });
    expect(plan.totalWeightKg).toBe(400);
    expect(plan.totalVolumeM3).toBe(4);
    expect(plan.weightUtilization).toBe(0.5);
    expect(plan.volumeUtilization).toBe(0.5);
    expect(plan.overCapacity).toBe(false);
    expect(plan.warnings).toHaveLength(0);
  });

  it('deriva capacidade do tipo de veículo quando não informada', () => {
    const plan = planLoad({ items: [{ id: 'a', sequence: 1, weightKg: 600 }], vehicleType: 'van' });
    expect(plan.capacityKg).toBe(1200);
    expect(plan.weightUtilization).toBe(0.5);
  });

  it('avisa excesso de peso e de volume', () => {
    const plan = planLoad({
      items: [{ id: 'a', sequence: 1, weightKg: 900, volumeM3: 10 }],
      capacityKg: 800,
      capacityVolumeM3: 8,
    });
    expect(plan.overCapacity).toBe(true);
    expect(plan.warnings).toEqual(
      expect.arrayContaining(['weight_over_capacity', 'volume_over_capacity']),
    );
  });

  it('avisa frágil sob carga quando fica na zona do fundo', () => {
    const plan = planLoad({
      items: [
        { id: 'a', sequence: 1 },
        { id: 'b', sequence: 2 },
        { id: 'c', sequence: 3, fragile: true },
      ],
    });
    expect(plan.warnings).toContain('fragile_under_load');
  });

  it('sem capacidade de referência devolve ocupação nula', () => {
    const plan = planLoad({ items: [{ id: 'a', sequence: 1, weightKg: 5 }] });
    expect(plan.capacityKg).toBeNull();
    expect(plan.weightUtilization).toBeNull();
    expect(plan.overCapacity).toBe(false);
  });
});
