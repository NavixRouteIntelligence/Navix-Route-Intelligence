import 'reflect-metadata';
// Instrumentação por efeito colateral (mesma regra do main.ts): antes do AppModule.
import './observability/instrument';

import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { shutdownTracing } from './observability/tracing';

/**
 * Entrypoint do **worker dedicado** de otimização (ADR-0055).
 *
 * Sobe o mesmo `AppModule` como *application context* (sem servidor HTTP): o
 * grafo de DI é o mesmo da API, então o `OptimizationJobWorker` inicializa e
 * passa a consumir a fila BullMQ — sem abrir porta, sem controllers atendendo.
 *
 * Uso: `node dist/main-worker.js`, com `OPTIMIZER_QUEUE_DRIVER=bullmq`. Numa
 * topologia dedicada, a API roda com `OPTIMIZER_WORKER_ENABLED=false` (só
 * enfileira) e este processo com `true`, isolando a CPU da otimização do
 * tráfego HTTP e permitindo escalar os dois separadamente.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();

  const logger = app.get(PinoLogger);
  logger.log('Worker de otimização iniciado (application context, sem HTTP).');

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Sinal ${signal} recebido; encerrando o worker.`);
    await app.close(); // dispara onModuleDestroy → Worker.close() (drena o job atual)
    await shutdownTracing();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
