import { fitWithinCapacity } from './capacity-fitting';

const parada = (id: string, weightKg: number, priority = 'normal') => ({
  id,
  priority,
  demand: { weightKg, volumeM3: 0 },
});

describe('fitWithinCapacity', () => {
  it('sem capacidade declarada, tudo entra (comportamento legado)', () => {
    const r = fitWithinCapacity([parada('a', 100), parada('b', 100)], null);

    expect(r.kept).toHaveLength(2);
    expect(r.dropped).toEqual([]);
  });

  // O limite exato cabe: 100 kg num veículo de 100 kg é carga válida.
  it('limite exato cabe', () => {
    const r = fitWithinCapacity([parada('a', 60), parada('b', 40)], {
      weightKg: 100,
      volumeM3: 10,
    });

    expect(r.kept.map((s) => s.id)).toEqual(['a', 'b']);
    expect(r.dropped).toEqual([]);
  });

  it('o que passa do limite fica de fora', () => {
    const r = fitWithinCapacity([parada('a', 60), parada('b', 60)], {
      weightKg: 100,
      volumeM3: 10,
    });

    expect(r.kept.map((s) => s.id)).toEqual(['a']);
    expect(r.dropped.map((s) => s.id)).toEqual(['b']);
  });

  // As duas dimensões contam: caber no peso não basta se estoura o volume.
  it('volume também corta, não só o peso', () => {
    const volumosa = { id: 'v', priority: 'normal', demand: { weightKg: 1, volumeM3: 9 } };
    const leve = { id: 'l', priority: 'normal', demand: { weightKg: 1, volumeM3: 2 } };

    const r = fitWithinCapacity([volumosa, leve], { weightKg: 100, volumeM3: 10 });

    expect(r.kept.map((s) => s.id)).toEqual(['v']);
    expect(r.dropped.map((s) => s.id)).toEqual(['l']);
  });

  it('urgente entra antes, mesmo chegando depois', () => {
    const r = fitWithinCapacity([parada('normal', 80), parada('urgente', 80, 'urgent')], {
      weightKg: 100,
      volumeM3: 10,
    });

    expect(r.kept.map((s) => s.id)).toEqual(['urgente']);
    expect(r.dropped.map((s) => s.id)).toEqual(['normal']);
  });

  // Uma parada grande demais não trava as menores que vêm depois.
  it('parada que sozinha não cabe não bloqueia as seguintes', () => {
    const r = fitWithinCapacity([parada('gigante', 500), parada('pequena', 10)], {
      weightKg: 100,
      volumeM3: 10,
    });

    expect(r.kept.map((s) => s.id)).toEqual(['pequena']);
    expect(r.dropped.map((s) => s.id)).toEqual(['gigante']);
  });

  // Entregas sem dado contam como zero (política explícita): todas cabem.
  it('demanda zero nunca estoura', () => {
    const r = fitWithinCapacity([parada('a', 0), parada('b', 0)], {
      weightKg: 1,
      volumeM3: 1,
    });

    expect(r.dropped).toEqual([]);
  });

  it('a ordem recebida é preservada no que fica', () => {
    const r = fitWithinCapacity([parada('a', 10), parada('b', 10), parada('c', 10)], {
      weightKg: 100,
      volumeM3: 10,
    });

    expect(r.kept.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});
