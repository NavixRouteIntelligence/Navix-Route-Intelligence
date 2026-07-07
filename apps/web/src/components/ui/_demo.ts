import type { VehicleStatus } from '@navix/contracts';

/** Dados fictícios usados apenas no style guide (/design-system). */
export const TABLE_DEMO: { plate: string; type: string; status: VehicleStatus }[] = [
  { plate: 'ABC1D23', type: 'Van', status: 'active' },
  { plate: 'XYZ9K88', type: 'Caminhão', status: 'maintenance' },
  { plate: 'JKL4M56', type: 'Moto', status: 'inactive' },
];
