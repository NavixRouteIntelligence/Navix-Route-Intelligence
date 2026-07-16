import { VEHICLE_CAPACITY_DEFAULTS, type OptimizationVehicleInput, type VehicleType } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import type { Demand } from './optimization-stop';

/**
 * Perfil operacional do veículo (ADR-0022). Encapsula as **restrições
 * específicas por tipo** — velocidade média realista, capacidade de peso/volume,
 * política de pedágio e restrições de acesso urbano (ex.: camião). Os defaults
 * por tipo podem ser sobrepostos por valores explícitos do request.
 *
 * `capacity = null` significa **sem restrição de capacidade** (comportamento
 * legado, quando nenhum veículo é informado).
 */
export interface VehicleTypeDefaults {
  averageSpeedKmh: number;
  capacity: Demand;
  avoidTolls: boolean;
  /** Restrições de circulação/acesso (ex.: camião em centro urbano). Informativo nesta fase. */
  urbanAccessRestricted: boolean;
}

// Defaults por tipo (tunáveis por tenant no futuro). Valores conservadores e
// plausíveis para última milha; a moto/bicicleta priorizam agilidade urbana.
// A **capacidade** vem da fonte única em `contracts` (ADR-0042); velocidade,
// pedágio e restrição urbana são afinações operacionais do otimizador.
const DEFAULTS: Record<VehicleType, VehicleTypeDefaults> = {
  bicycle: {
    averageSpeedKmh: 15,
    capacity: VEHICLE_CAPACITY_DEFAULTS.bicycle,
    avoidTolls: true,
    urbanAccessRestricted: false,
  },
  motorcycle: {
    averageSpeedKmh: 35,
    capacity: VEHICLE_CAPACITY_DEFAULTS.motorcycle,
    avoidTolls: true,
    urbanAccessRestricted: false,
  },
  car: {
    averageSpeedKmh: 40,
    capacity: VEHICLE_CAPACITY_DEFAULTS.car,
    avoidTolls: false,
    urbanAccessRestricted: false,
  },
  van: {
    averageSpeedKmh: 35,
    capacity: VEHICLE_CAPACITY_DEFAULTS.van,
    avoidTolls: false,
    urbanAccessRestricted: false,
  },
  truck: {
    averageSpeedKmh: 28,
    capacity: VEHICLE_CAPACITY_DEFAULTS.truck,
    avoidTolls: false,
    urbanAccessRestricted: true,
  },
};

export class VehicleProfile {
  private constructor(
    readonly type: VehicleType | null,
    readonly averageSpeedKmh: number,
    readonly capacity: Demand | null,
    readonly avoidTolls: boolean,
    readonly urbanAccessRestricted: boolean,
  ) {}

  /** Defaults conhecidos de um tipo (para inspeção/uso externo). */
  static defaultsFor(type: VehicleType): VehicleTypeDefaults {
    return DEFAULTS[type];
  }

  /**
   * Resolve o perfil a partir do input do request. Sem `input`/`type`, devolve um
   * perfil **sem capacidade** (legado), usando `fallbackSpeedKmh` como velocidade.
   * Overrides numéricos do input têm precedência sobre os defaults do tipo.
   */
  static resolve(
    input: OptimizationVehicleInput | null | undefined,
    fallbackSpeedKmh: number,
  ): VehicleProfile {
    const type = input?.type ?? null;
    const base = type ? DEFAULTS[type] : null;

    const capacityKg = input?.capacityKg ?? base?.capacity.weightKg ?? null;
    const capacityVolumeM3 = input?.capacityVolumeM3 ?? base?.capacity.volumeM3 ?? null;
    if (capacityKg !== null && capacityKg <= 0) {
      throw new ValidationError('Capacidade de peso do veículo deve ser positiva.');
    }
    if (capacityVolumeM3 !== null && capacityVolumeM3 <= 0) {
      throw new ValidationError('Capacidade de volume do veículo deve ser positiva.');
    }

    const capacity: Demand | null =
      capacityKg === null && capacityVolumeM3 === null
        ? null
        : { weightKg: capacityKg ?? Infinity, volumeM3: capacityVolumeM3 ?? Infinity };

    const speed = base?.averageSpeedKmh ?? fallbackSpeedKmh;
    const avoidTolls = input?.avoidTolls ?? base?.avoidTolls ?? false;
    const urbanAccessRestricted = base?.urbanAccessRestricted ?? false;

    return new VehicleProfile(type, speed, capacity, avoidTolls, urbanAccessRestricted);
  }
}
