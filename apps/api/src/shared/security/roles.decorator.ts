import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Declara os papéis exigidos por uma rota (RBAC — ver docs/security.md §3).
 * Uso: `@Roles('admin')`. A verificação é feita pelo RolesGuard.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
