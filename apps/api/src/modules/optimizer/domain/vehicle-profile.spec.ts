import { ValidationError } from '../../../shared/kernel/domain-error';
import { VehicleProfile } from './vehicle-profile';

describe('VehicleProfile', () => {
  it('sem input: perfil sem capacidade (legado) usando a velocidade de fallback', () => {
    const p = VehicleProfile.resolve(undefined, 30);
    expect(p.type).toBeNull();
    expect(p.capacity).toBeNull();
    expect(p.averageSpeedKmh).toBe(30);
  });

  it('aplica defaults por tipo (moto ágil, camião pesado e restrito)', () => {
    const moto = VehicleProfile.resolve({ type: 'motorcycle' }, 30);
    expect(moto.capacity?.weightKg).toBe(30);
    expect(moto.averageSpeedKmh).toBe(35);
    expect(moto.avoidTolls).toBe(true);

    const truck = VehicleProfile.resolve({ type: 'truck' }, 30);
    expect(truck.capacity?.weightKg).toBe(12000);
    expect(truck.urbanAccessRestricted).toBe(true);
    expect(truck.avoidTolls).toBe(false);
  });

  it('overrides numéricos têm precedência sobre os defaults do tipo', () => {
    const p = VehicleProfile.resolve({ type: 'van', capacityKg: 500, avoidTolls: true }, 30);
    expect(p.capacity?.weightKg).toBe(500);
    expect(p.capacity?.volumeM3).toBe(8); // volume mantém o default da carrinha
    expect(p.avoidTolls).toBe(true);
  });

  it('capacidade só numa dimensão: a outra vira ilimitada (Infinity)', () => {
    const p = VehicleProfile.resolve({ capacityKg: 100 }, 30);
    expect(p.capacity?.weightKg).toBe(100);
    expect(p.capacity?.volumeM3).toBe(Infinity);
  });

  it('rejeita capacidade não positiva', () => {
    expect(() => VehicleProfile.resolve({ capacityKg: 0 }, 30)).toThrow(ValidationError);
    expect(() => VehicleProfile.resolve({ capacityVolumeM3: -1 }, 30)).toThrow(ValidationError);
  });
});
