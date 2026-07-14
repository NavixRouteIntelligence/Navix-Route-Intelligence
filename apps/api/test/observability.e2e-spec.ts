import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MetricsModule } from '../src/observability/metrics/metrics.module';

/** Controller de teste para exercitar o interceptor global de métricas HTTP. */
@Controller('demo')
class DemoController {
  @Get('ok')
  ok(): { ok: boolean } {
    return { ok: true };
  }
}

describe('Observabilidade — /metrics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule],
      controllers: [DemoController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('expõe /metrics no formato Prometheus', async () => {
    const res = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('process_cpu_user_seconds_total');
    expect(res.text).toContain('http_server_requests_total');
  });

  it('o interceptor registra a requisição com o template da rota', async () => {
    await request(app.getHttpServer()).get('/demo/ok').expect(200);
    const res = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(res.text).toMatch(/route="\/demo\/ok"/);
    expect(res.text).toContain('status_code="200"');
  });
});
