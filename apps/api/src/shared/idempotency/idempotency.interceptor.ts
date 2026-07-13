import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { firstValueFrom, from, Observable } from 'rxjs';
import type { EntityManager } from 'typeorm';

import { transactionContext } from '../database/transaction-context';
import { ValidationError } from '../kernel/domain-error';
import { newId } from '../kernel/id';
import { IDEMPOTENT_KEY } from './idempotency.decorator';

interface StoredResponse {
  response_status: number;
  response_body: unknown;
}

/**
 * Deduplica reenvios de operações **críticas** marcadas com `@Idempotent()`
 * (POD, tracking, import, otimização — ADR-0017). Fluxo, quando o header
 * `Idempotency-Key` está presente:
 *
 *  1. Se já existe resposta para (tenant, key, método, rota) → **replica** a
 *     resposta armazenada, sem re-executar o handler.
 *  2. Senão → executa, e grava a resposta na **mesma transação de tenant** (RLS)
 *     aberta pelo `TenantTransactionInterceptor` — atômico com a operação.
 *
 * A idempotência é **opcional**: sem o header, o comportamento é o normal. O
 * índice único `(tenant, key, método, rota)` é a rede de segurança contra corrida
 * (reenvios sequenciais offline — o caso alvo — são sempre deduplicados).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!enabled) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: { tenantId: string } }>();
    const raw = req.headers['idempotency-key'];
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (!key) return next.handle(); // idempotência é opcional

    if (key.length < 8 || key.length > 200) {
      throw new ValidationError('Idempotency-Key deve ter entre 8 e 200 caracteres.');
    }

    const manager = transactionContext.getStore();
    const tenantId = req.user?.tenantId;
    // Sem transação de tenant não há como isolar/gravar com segurança → passa direto.
    if (!manager || !tenantId) return next.handle();

    return from(this.process(context, next, manager, tenantId, key));
  }

  private async process(
    context: ExecutionContext,
    next: CallHandler,
    manager: EntityManager,
    tenantId: string,
    key: string,
  ): Promise<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = req.method;
    const path = req.route?.path ?? req.path;

    const existing = (await manager.query(
      `SELECT response_status, response_body FROM idempotency_keys
         WHERE idempotency_key = $1 AND method = $2 AND path = $3 LIMIT 1`,
      [key, method, path],
    )) as StoredResponse[];

    if (existing.length > 0) {
      // Replay: a resposta original é devolvida; o status vem do @HttpCode da rota.
      res.setHeader('Idempotency-Replayed', 'true');
      return existing[0].response_body;
    }

    const body = await firstValueFrom(next.handle());
    const status =
      this.reflector.get<number>(HTTP_CODE_METADATA, context.getHandler()) ??
      (method === 'POST' ? 201 : 200);

    await manager.query(
      `INSERT INTO idempotency_keys
         (id, tenant_id, idempotency_key, method, path, response_status, response_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newId(), tenantId, key, method, path, status, JSON.stringify(body ?? null)],
    );
    return body;
  }
}
