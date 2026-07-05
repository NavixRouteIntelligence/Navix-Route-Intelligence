/**
 * Erros de domínio tipados. Distinguem falhas esperadas de negócio de erros
 * inesperados (bugs/infra). Os filtros de exceção da camada de interface
 * mapeiam estes erros para respostas HTTP padronizadas (ver docs/api.md §7).
 */

export type DomainErrorKind =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly kind = 'VALIDATION' as const;
  constructor(message = 'Dados inválidos.') {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  readonly kind = 'NOT_FOUND' as const;
  constructor(message = 'Recurso não encontrado.') {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly kind = 'CONFLICT' as const;
  constructor(message = 'Conflito de estado.') {
    super(message);
  }
}

export class UnauthorizedError extends DomainError {
  readonly kind = 'UNAUTHORIZED' as const;
  constructor(message = 'Não autenticado.') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly kind = 'FORBIDDEN' as const;
  constructor(message = 'Acesso negado.') {
    super(message);
  }
}
