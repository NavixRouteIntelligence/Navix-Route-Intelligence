import { statusFor } from './route-plan';

/**
 * NAV-4.11 / ADR-0110: o estado é derivado, nunca informado. Enquanto o único
 * valor possível era `completed`, uma rota que deixou três entregas para trás
 * saía marcada como completa.
 */
describe('statusFor', () => {
  it('sem exclusões, o plano é completo', () => {
    expect(statusFor(undefined)).toBe('completed');
    expect(statusFor([])).toBe('completed');
  });

  it('qualquer exclusão torna o plano parcial', () => {
    expect(statusFor([{ deliveryId: 'd1', reason: 'capacity' }])).toBe('partial');
    expect(statusFor([{ deliveryId: 'd1', reason: 'isolated' }])).toBe('partial');
    expect(statusFor([{ deliveryId: 'd1', reason: 'disconnected' }])).toBe('partial');
  });

  it('motivos diferentes na mesma lista seguem sendo parcial', () => {
    expect(
      statusFor([
        { deliveryId: 'd1', reason: 'capacity' },
        { deliveryId: 'd2', reason: 'isolated' },
      ]),
    ).toBe('partial');
  });
});
