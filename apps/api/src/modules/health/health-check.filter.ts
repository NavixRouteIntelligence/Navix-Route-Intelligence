import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Preserva o corpo do Terminus nas respostas de saúde (ADR-0114).
 *
 * O filtro global traduz toda `HttpException` para o envelope de erro da API
 * (`{error: {code, message, requestId}}`), que é o certo para as rotas de
 * negócio e o **errado** aqui: o `/ready` com falha virava
 * `"Service Unavailable Exception"`, sem dizer qual dependência caiu. Quem
 * consulta um health em vermelho está justamente perguntando *o quê*.
 *
 * Só se aplica ao `HealthController`; o contrato de erro da API fica intacto.
 */
@Catch(HttpException)
export class HealthCheckFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = exception.getResponse();
    response
      .status(exception.getStatus())
      .json(typeof body === 'string' ? { status: 'error', message: body } : body);
  }
}
