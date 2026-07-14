import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('expõe métricas padrão + HTTP no formato Prometheus', async () => {
    const svc = new MetricsService();
    svc.observeHttp('GET', '/deliveries/:id', 200, 0.42);

    const out = await svc.scrape();
    expect(svc.contentType()).toContain('text/plain');
    // Métricas de processo (default) e as de HTTP registradas.
    expect(out).toContain('process_cpu_user_seconds_total');
    expect(out).toContain('http_server_requests_total');
    expect(out).toContain('http_server_request_duration_seconds');
    // Label de rota usa o template (baixa cardinalidade).
    expect(out).toContain('route="/deliveries/:id"');
    expect(out).toContain('status_code="200"');
  });

  it('acumula contagem por rota/método/status', async () => {
    const svc = new MetricsService();
    svc.observeHttp('POST', '/pod', 201, 0.1);
    svc.observeHttp('POST', '/pod', 201, 0.2);

    const value = await svc.registry.getSingleMetricAsString('http_server_requests_total');
    expect(value).toMatch(/http_server_requests_total\{[^}]*route="\/pod"[^}]*\}\s+2/);
  });
});
