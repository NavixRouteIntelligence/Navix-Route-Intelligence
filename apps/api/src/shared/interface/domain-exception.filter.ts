import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorCode, ApiErrorResponse } from '@navix/contracts';
import type { Request, Response } from 'express';

import { DomainError, DomainErrorKind } from '../kernel/domain-error';

const KIND_TO_HTTP: Record<DomainErrorKind, { status: number; code: ApiErrorCode }> = {
  VALIDATION: { status: HttpStatus.BAD_REQUEST, code: 'VALIDATION_ERROR' },
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND' },
  CONFLICT: { status: HttpStatus.CONFLICT, code: 'CONFLICT' },
  UNAUTHORIZED: { status: HttpStatus.UNAUTHORIZED, code: 'UNAUTHENTICATED' },
  FORBIDDEN: { status: HttpStatus.FORBIDDEN, code: 'FORBIDDEN' },
};

/**
 * Filtro global de exceções. Converte erros de domínio e HTTP em respostas
 * padronizadas (ver docs/api.md §7). Nunca vaza detalhes internos: erros
 * inesperados viram 500 genérico e são logados com o requestId.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId = request.id ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = 'INTERNAL';
    let message = 'Erro interno.';

    if (exception instanceof DomainError) {
      ({ status, code } = KIND_TO_HTTP[exception.kind]);
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = this.httpStatusToCode(status);
      message = exception.message;
    } else {
      // Erro inesperado: logar detalhes, mas não expor ao cliente.
      this.logger.error(
        `Unhandled exception [${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = {
      error: { code, message, requestId },
    };
    response.status(status).json(body);
  }

  private httpStatusToCode(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL';
    }
  }
}
