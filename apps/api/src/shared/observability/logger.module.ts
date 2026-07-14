import { randomUUID } from 'node:crypto';

import { Global, Module } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

/**
 * Logging estruturado (JSON) com correlação por requisição.
 * Cada log carrega um `requestId`; `tenantId`/`userId` são adicionados quando
 * o contexto de tenant estiver disponível (ver docs/architecture.md §10).
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id = typeof existing === 'string' && existing ? existing : randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // Correlação com o tracing: quando o OTel está ativo, anexa
        // trace_id/span_id para casar logs ↔ traces (Grafana/Tempo/Jaeger).
        // Sem tracing, `getActiveSpan()` é undefined e nada é adicionado.
        customProps: (req) => {
          const requestId = (req as { id?: string }).id;
          const span = trace.getActiveSpan()?.spanContext();
          return span
            ? { requestId, trace_id: span.traceId, span_id: span.spanId }
            : { requestId };
        },
        // Nunca logar segredos/PII (ver docs/security.md).
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'req.body.password',
            'req.body.refreshToken',
          ],
          remove: true,
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
  ],
})
export class LoggerModule {}
