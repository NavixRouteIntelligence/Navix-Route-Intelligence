import { seesWholeTenant } from './delivery-visibility';

describe('seesWholeTenant (ADR-0100)', () => {
  it.each([['admin'], ['dispatcher'], ['fleet_manager'], ['api']])(
    '%s enxerga o tenant inteiro',
    (role) => {
      expect(seesWholeTenant([role])).toBe(true);
    },
  );

  it('motorista não enxerga o tenant inteiro', () => {
    // O papel do autônomo e o do motorista convidado são o mesmo (`['driver']`):
    // a diferença entre eles é ter ou não ficha, não o papel.
    expect(seesWholeTenant(['driver'])).toBe(false);
  });

  it('falha fechado para papel desconhecido e para conta sem papel', () => {
    expect(seesWholeTenant(['papel_que_ainda_nao_existe'])).toBe(false);
    expect(seesWholeTenant([])).toBe(false);
  });

  it('um papel amplo entre outros já concede a visão completa', () => {
    expect(seesWholeTenant(['driver', 'admin'])).toBe(true);
  });
});
