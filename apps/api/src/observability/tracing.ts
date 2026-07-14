import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/**
 * Tracing distribuído com OpenTelemetry.
 *
 * **Opt-in e sem efeito colateral por padrão:** só inicializa quando
 * `OTEL_ENABLED=true`. Desligado (o default em dev/test/local sem coletor), é um
 * no-op total — nenhuma instrumentação é aplicada e nada muda no comportamento.
 *
 * Precisa rodar **antes** de qualquer módulo instrumentado ser carregado; por
 * isso `main.ts` importa e chama `startTracing()` como primeira instrução, antes
 * de importar o `AppModule`. As instrumentações automáticas cobrem HTTP/Express
 * (entrada), `pg` (Postgres/TypeORM) e `ioredis` (Redis), propagando o contexto
 * de trace (W3C `traceparent`) ponta a ponta. O exportador OTLP lê o endpoint de
 * `OTEL_EXPORTER_OTLP_ENDPOINT` (padrão `http://localhost:4318`).
 */
let sdk: NodeSDK | undefined;

export function startTracing(): void {
  if (process.env.OTEL_ENABLED !== 'true' || sdk) return;

  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'navix-api',
      [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION ?? '0.1.0',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    // O endpoint vem de OTEL_EXPORTER_OTLP_ENDPOINT (convenção OTel).
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // `fs` gera ruído altíssimo e nenhum valor operacional.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
}

/** Encerra o SDK com flush dos spans pendentes (chamado no shutdown do Nest). */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } finally {
    sdk = undefined;
  }
}

/** Exposto para diagnóstico/testes: o tracing está ativo? */
export function isTracingEnabled(): boolean {
  return sdk !== undefined;
}
