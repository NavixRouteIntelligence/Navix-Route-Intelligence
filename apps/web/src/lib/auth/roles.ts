import type { AuthenticatedUser } from '@navix/contracts';

/**
 * Utilitários de RBAC no cliente. A interface é adaptada pelos papéis do usuário
 * (vindos no JWT / em /auth/me), não por flags separadas — fonte única de verdade.
 */

export function hasRole(user: AuthenticatedUser | null, ...roles: string[]): boolean {
  if (!user) return false;
  return user.roles.some((r) => roles.includes(r));
}

/** Motorista autônomo: papel `driver`. */
export function isDriver(user: AuthenticatedUser | null): boolean {
  return hasRole(user, 'driver');
}

/** Perfis administrativos (empresa). */
export function isAdmin(user: AuthenticatedUser | null): boolean {
  return hasRole(user, 'admin', 'dispatcher', 'fleet_manager');
}

/** Rota inicial conforme o perfil. */
export function homePath(user: AuthenticatedUser | null): string {
  return isDriver(user) && !isAdmin(user) ? '/driver' : '/dashboard';
}
