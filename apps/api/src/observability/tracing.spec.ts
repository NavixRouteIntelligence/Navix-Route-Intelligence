import { isTracingEnabled, startTracing } from './tracing';

describe('tracing (OpenTelemetry, opt-in)', () => {
  const original = process.env.OTEL_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.OTEL_ENABLED;
    else process.env.OTEL_ENABLED = original;
  });

  it('é no-op quando OTEL_ENABLED não é "true" (sem efeito colateral)', () => {
    delete process.env.OTEL_ENABLED;
    startTracing();
    expect(isTracingEnabled()).toBe(false);

    process.env.OTEL_ENABLED = 'false';
    startTracing();
    expect(isTracingEnabled()).toBe(false);
  });
});
