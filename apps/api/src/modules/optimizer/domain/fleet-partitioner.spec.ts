import { partitionByCapacity, type PartitionStop, type PartitionVehicle } from './fleet-partitioner';
import { GeoPoint } from './geo-point';

const at = (lat: number, lng: number, weightKg = 0, volumeM3 = 0): PartitionStop => ({
  point: GeoPoint.create(lat, lng),
  demand: { weightKg, volumeM3 },
});

const uncapped: PartitionVehicle = { capacity: null };
const capped = (weightKg: number): PartitionVehicle => ({
  capacity: { weightKg, volumeM3: Infinity },
});

describe('partitionByCapacity (sweep)', () => {
  it('sem capacidade: balanceia por contagem (~N/V) entre os veículos', () => {
    const stops = [at(1, 1), at(1, -1), at(-1, -1), at(-1, 1)];
    const { clusters, unassigned } = partitionByCapacity(stops, [uncapped, uncapped], null);
    expect(unassigned).toHaveLength(0);
    expect(clusters[0]).toHaveLength(2);
    expect(clusters[1]).toHaveLength(2);
    // Cada parada aparece em exatamente um cluster.
    expect([...clusters[0], ...clusters[1]].sort()).toEqual([0, 1, 2, 3]);
  });

  it('respeita a capacidade de peso e sobra o que não cabe', () => {
    // 3 paradas de 20 kg, 2 veículos de 30 kg → cabe 1 por veículo, 1 sobra.
    const stops = [at(1, 1, 20), at(1, -1, 20), at(-1, 0, 20)];
    const { clusters, unassigned } = partitionByCapacity(stops, [capped(30), capped(30)], null);
    expect(clusters[0]).toHaveLength(1);
    expect(clusters[1]).toHaveLength(1);
    expect(unassigned).toHaveLength(1);
  });

  it('parada maior que qualquer veículo: não atribuída', () => {
    const stops = [at(1, 1, 100), at(1, -1, 10)];
    const { clusters, unassigned } = partitionByCapacity(stops, [capped(30)], null);
    expect(clusters[0]).toEqual([1]); // a de 10 kg cabe
    expect(unassigned).toHaveLength(1); // a de 100 kg não
  });

  it('sem veículos: tudo fica não atribuído', () => {
    const stops = [at(1, 1), at(2, 2)];
    const { clusters, unassigned } = partitionByCapacity(stops, [], null);
    expect(clusters).toHaveLength(0);
    expect(unassigned).toEqual([0, 1]);
  });
});
