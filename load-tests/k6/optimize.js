// BENCHMARK de otimização de rotas — o caminho mais caro em CPU. Exercita o
// fluxo ASSÍNCRONO real: POST /route-plans (202 + jobId) → poll do job até
// succeeded → mede o tempo ponta a ponta. Usa paradas INLINE (não precisa de
// dados semeados). Varie o tamanho da rota para ver como o solver escala.
//   k6 run optimize.js
//   k6 run -e STOPS=50 -e VUS=5 -e ITER=40 optimize.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

import { BASE_URL, authHeaders, login, makeStops, uuidv4 } from './lib.js';

const STOPS = Number(__ENV.STOPS || 25);
const VUS = Number(__ENV.VUS || 4);
const ITER = Number(__ENV.ITER || 30);
const POLL_INTERVAL = 0.5; // s
const POLL_MAX = 60; // tentativas (~30s de teto)

// Métricas custom: o que realmente interessa neste benchmark.
const e2e = new Trend('optimize_e2e_ms', true); // POST → plano pronto
const enqueue = new Trend('optimize_enqueue_ms', true); // só o POST (202)
const failed = new Rate('optimize_failed');

export const options = {
  scenarios: {
    optimize: { executor: 'per-vu-iterations', vus: VUS, iterations: ITER, maxDuration: '10m' },
  },
  thresholds: {
    // Referência: com Haversine, o solve é ~ms; o e2e é dominado pelo poll/fila.
    optimize_failed: ['rate<0.02'],
    optimize_e2e_ms: ['p(95)<10000'], // 95% conclui em < 10s
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  const started = Date.now();
  const body = JSON.stringify({ stops: makeStops(STOPS) });

  // 1) Enfileira (espera 202 + jobId).
  const post = http.post(
    `${BASE_URL}/route-plans`,
    body,
    authHeaders(data.token, { 'Idempotency-Key': uuidv4() }),
  );
  enqueue.add(post.timings.duration);
  const ok202 = check(post, { 'enqueue 202': (r) => r.status === 202 });
  if (!ok202) {
    failed.add(1);
    return;
  }
  const jobId = post.json('data.jobId');

  // 2) Poll do job até succeeded/failed.
  let status = 'queued';
  for (let i = 0; i < POLL_MAX; i++) {
    sleep(POLL_INTERVAL);
    const job = http.get(
      `${BASE_URL}/route-plans/jobs/${jobId}`,
      authHeaders(data.token, { tags: { name: 'job_poll' } }),
    );
    if (job.status !== 200) continue;
    status = job.json('data.status');
    if (status === 'succeeded' || status === 'failed') break;
  }

  const success = status === 'succeeded';
  failed.add(success ? 0 : 1);
  if (success) e2e.add(Date.now() - started);
  check(null, { 'otimização concluída': () => success });
}
