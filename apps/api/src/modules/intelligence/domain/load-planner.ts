import {
  VEHICLE_CAPACITY_DEFAULTS,
  type LoadItemInput,
  type LoadPlacementView,
  type LoadPlanRequest,
  type LoadPlanView,
  type LoadZone,
} from '@navix/contracts';

/**
 * Capacidade de referência por tipo de veículo (quando o request não informa
 * `capacityKg`/`capacityVolumeM3`). **Fonte única** em `contracts` (ADR-0042),
 * compartilhada com o `VehicleProfile` do otimizador — sem duplicar os números.
 */
const CAPACITY_BY_TYPE = VEHICLE_CAPACITY_DEFAULTS;

function zoneFor(index: number, total: number): LoadZone {
  // `index` é a posição na ordem de ENTREGA (0 = primeira a sair).
  // A primeira a sair fica junto à porta; a última vai ao fundo.
  if (total <= 1) return 'door';
  const ratio = index / (total - 1);
  if (ratio <= 1 / 3) return 'door';
  if (ratio <= 2 / 3) return 'middle';
  return 'front';
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Organização otimizada da carga (ADR-0030). Regra central: **LIFO** — o que é
 * entregue primeiro é carregado por último (fica junto à porta / por cima),
 * minimizando remanejo a cada parada. Calcula ocupação de peso/volume e avisos
 * operacionais (excesso de capacidade, frágil sob carga).
 *
 * Função **pura** e determinística; um planejador 3D (bin packing) pode
 * substituí-la atrás da `LoadPlannerPort` sem tocar consumidores.
 */
export function planLoad(input: LoadPlanRequest): LoadPlanView {
  const typeDefaults = input.vehicleType ? CAPACITY_BY_TYPE[input.vehicleType] : null;
  const capacityKg = input.capacityKg ?? typeDefaults?.weightKg ?? null;
  const capacityVolumeM3 = input.capacityVolumeM3 ?? typeDefaults?.volumeM3 ?? null;

  // Ordem de entrega crescente (1 = primeira a sair). Estável para empates.
  const byDelivery = [...input.items].sort((a, b) => a.sequence - b.sequence);
  const total = byDelivery.length;

  const normalized = byDelivery.map((item: LoadItemInput, index) => ({
    item,
    index,
    weightKg: Math.max(0, item.weightKg ?? 0),
    volumeM3: Math.max(0, item.volumeM3 ?? 0),
    fragile: item.fragile ?? false,
    zone: zoneFor(index, total),
  }));

  // Carregamento = inverso da entrega (LIFO): a última entrega entra primeiro.
  const placements: LoadPlacementView[] = normalized
    .map((n, i) => ({
      id: n.item.id,
      ...(n.item.label !== undefined ? { label: n.item.label } : {}),
      loadOrder: total - i, // maior index de entrega → menor loadOrder (carrega antes)
      deliverySequence: n.item.sequence,
      zone: n.zone,
      weightKg: round(n.weightKg),
      volumeM3: round(n.volumeM3),
      fragile: n.fragile,
    }))
    .sort((a, b) => a.loadOrder - b.loadOrder);

  const totalWeightKg = round(normalized.reduce((s, n) => s + n.weightKg, 0));
  const totalVolumeM3 = round(normalized.reduce((s, n) => s + n.volumeM3, 0));

  const weightUtilization =
    capacityKg && capacityKg > 0 ? round(totalWeightKg / capacityKg) : null;
  const volumeUtilization =
    capacityVolumeM3 && capacityVolumeM3 > 0 ? round(totalVolumeM3 / capacityVolumeM3) : null;

  const overCapacity =
    (capacityKg !== null && totalWeightKg > capacityKg) ||
    (capacityVolumeM3 !== null && totalVolumeM3 > capacityVolumeM3);

  const warnings: string[] = [];
  if (capacityKg !== null && totalWeightKg > capacityKg) {
    warnings.push('weight_over_capacity');
  }
  if (capacityVolumeM3 !== null && totalVolumeM3 > capacityVolumeM3) {
    warnings.push('volume_over_capacity');
  }
  // Frágil que não fica junto à porta tende a receber carga por cima.
  if (normalized.some((n) => n.fragile && n.zone === 'front')) {
    warnings.push('fragile_under_load');
  }

  return {
    placements,
    totalWeightKg,
    totalVolumeM3,
    capacityKg,
    capacityVolumeM3,
    weightUtilization,
    volumeUtilization,
    overCapacity,
    warnings,
  };
}
