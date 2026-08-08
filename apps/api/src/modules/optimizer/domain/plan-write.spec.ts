import { decidePlanWrite } from './plan-write';
import { RoutePlan, type NewRoutePlan } from './route-plan';

const TENANT = 'tenant-1';
const FICHA = 'driver-1';

function plano(requestedAt: string, version?: number): RoutePlan {
  const base: NewRoutePlan = {
    tenantId: TENANT,
    driverId: FICHA,
    driverScoped: true,
    requestedAt: new Date(requestedAt),
    strategy: 'nearest-neighbor-2opt',
    params: { averageSpeedKmh: 30, serviceTimeMinutes: 5, hasOrigin: false },
    stops: [],
    metrics: { totalDistanceKm: 10, totalTimeMinutes: 60, stops: 2 },
    baseline: { totalDistanceKm: 12, totalTimeMinutes: 70, stops: 2 },
    savings: { distanceKm: 2, distancePct: 17, timeMinutes: 10, timePct: 14 },
    score: 80,
    explanation: 'ok',
    ...(version ? { version } : {}),
  };
  return RoutePlan.create(base);
}

describe('decidePlanWrite', () => {
  it('sem rota vigente, a primeira gravação é a versão 1', () => {
    expect(decidePlanWrite(plano('2026-08-08T10:00:00Z'), null)).toEqual({
      action: 'write',
      version: 1,
    });
  });

  it('pedido mais recente grava a versão seguinte', () => {
    const vigente = plano('2026-08-08T10:00:00Z', 3);

    expect(decidePlanWrite(plano('2026-08-08T10:05:00Z'), vigente)).toEqual({
      action: 'write',
      version: 4,
    });
  });

  // Execução fora de ordem: o job antigo terminou por último. É o caso que a
  // ADR-0103 já nomeava e que agora tem versão para descrever.
  it('resultado de um pedido anterior é descartado como obsoleto', () => {
    const vigente = plano('2026-08-08T10:05:00Z', 2);

    const d = decidePlanWrite(plano('2026-08-08T10:00:00Z'), vigente);

    expect(d.action).toBe('discard');
    expect(d).toMatchObject({ reason: 'stale', winner: vigente });
  });

  // Repetição: dois pedidos no mesmo instante descrevem a mesma intenção. Antes
  // o empate gravava — "o último a chegar vence" —, e a rota do motorista
  // passava a existir em duas linhas para o mesmo instante de pedido.
  it('pedido no mesmo instante é duplicata, e não uma rota nova', () => {
    const vigente = plano('2026-08-08T10:00:00Z', 1);

    const d = decidePlanWrite(plano('2026-08-08T10:00:00Z'), vigente);

    expect(d).toMatchObject({ action: 'discard', reason: 'duplicate' });
  });

  it('a decisão não depende de quando cada resultado ficou pronto', () => {
    const vigente = plano('2026-08-08T10:05:00Z', 2);
    const atrasado = plano('2026-08-08T10:00:00Z');

    // Mesmo par, decidido duas vezes com folga entre elas: só `requestedAt`
    // entra na conta, então o desfecho é o mesmo.
    expect(decidePlanWrite(atrasado, vigente)).toEqual(decidePlanWrite(atrasado, vigente));
  });

  it('a versão cresce de um em um, sem buracos', () => {
    let vigente = plano('2026-08-08T10:00:00Z', 1);
    const versoes: number[] = [];

    for (let i = 1; i <= 4; i++) {
      const novo = plano(`2026-08-08T10:0${i}:00Z`);
      const d = decidePlanWrite(novo, vigente);
      if (d.action !== 'write') throw new Error('esperava gravação');
      versoes.push(d.version);
      vigente = novo.withVersion(d.version);
    }

    expect(versoes).toEqual([2, 3, 4, 5]);
  });
});
