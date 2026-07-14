/**
 * Ponto de instrumentação carregado por **efeito colateral**: `main.ts` faz
 * `import './observability/instrument'` como primeiríssimo import, garantindo —
 * em CommonJS e ESM — que o OpenTelemetry inicialize antes de qualquer módulo
 * instrumentado (http/express/pg/ioredis) ser carregado. No-op se OTEL_ENABLED
 * != 'true'. Ver tracing.ts.
 */
import { startTracing } from './tracing';

startTracing();
