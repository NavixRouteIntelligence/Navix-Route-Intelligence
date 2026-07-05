import { randomUUID } from 'node:crypto';

import { Global, Module } from '@nestjs/common';
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
        customProps: (req) => ({ requestId: (req as { id?: string }).id }),
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
