import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { ROLES_KEY } from '../../../shared/security/roles.decorator';
import { DriverInviteController } from './driver-invite.controller';
import { PublicDriverInviteController } from './public-driver-invite.controller';

/** Guards declarados por `@UseGuards` na classe, como o Nest os enxerga. */
function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata('__guards__', target) as unknown[]) ?? [];
}

describe('RBAC do convite de motorista', () => {
  const reflector = new Reflector();

  it('convidar exige admin ou fleet_manager', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, DriverInviteController.prototype.create);

    expect(roles).toEqual(['admin', 'fleet_manager']);
  });

  // `dispatcher` e `driver` autenticam mas não passam no RolesGuard: quem
  // despacha rotas — ou quem já é motorista — não decide quem entra na
  // organização.
  it('dispatcher e driver não estão entre os papéis que convidam', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, DriverInviteController.prototype.create);

    expect(roles).not.toContain('dispatcher');
    expect(roles).not.toContain('driver');
  });

  it('a emissão do convite é autenticada e passa pelo RolesGuard', () => {
    const guards = guardsOf(DriverInviteController);

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  // Se o endpoint público ganhasse JwtAuthGuard, o convidado — que ainda não
  // tem conta — nunca conseguiria criá-la. A ausência é o desenho, e este teste
  // existe para que ela permaneça deliberada.
  it('validar e aceitar são públicos por desenho — sem guard de autenticação', () => {
    const guards = guardsOf(PublicDriverInviteController);

    expect(guards).toEqual([]);
  });

  it('nenhum papel é exigido no fluxo público', () => {
    expect(
      reflector.get<string[]>(ROLES_KEY, PublicDriverInviteController.prototype.accept),
    ).toBeUndefined();
    expect(
      reflector.get<string[]>(ROLES_KEY, PublicDriverInviteController.prototype.validate),
    ).toBeUndefined();
  });
});
