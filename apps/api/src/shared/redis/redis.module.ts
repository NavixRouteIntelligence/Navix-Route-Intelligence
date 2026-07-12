import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppConfigService } from '../config/app-config.service';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Conexão Redis única e compartilhada (ioredis), base para rate limiting, cache
 * e filas (ADR-0002). Resiliente **por design**: se o Redis estiver indisponível,
 * a aplicação **não** deixa de funcionar — as funcionalidades que o usam degradam
 * graciosamente (rate limiting cai para storage em memória; cache vira miss).
 * Assim, ligar o Redis não altera o comportamento atual em ambientes sem Redis.
 *
 * `enableOfflineQueue: false` faz os comandos falharem rápido quando desconectado
 * (em vez de enfileirar/travar), o que permite o fallback imediato.
 */
const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): Redis => {
    const logger = new Logger('Redis');
    const { host, port, password } = config.redis;

    const client = new Redis({
      host,
      port,
      password,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      // Backoff crescente e limitado; mantém tentativas de reconexão sem travar.
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    // 'error' precisa de listener: um EventEmitter sem listener de 'error' derruba
    // o processo. Logamos a primeira falha e silenciamos as repetições (evita spam).
    let errorLogged = false;
    client.on('error', (err: Error) => {
      if (!errorLogged) {
        logger.warn(
          `Redis indisponível (${err.message}). Operando em modo degradado (fallback).`,
        );
        errorLogged = true;
      }
    });
    client.on('ready', () => {
      errorLogged = false;
      logger.log('Redis conectado.');
    });

    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /** Encerra a conexão no shutdown (evita handles abertos). */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
