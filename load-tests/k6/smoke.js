// Smoke — 1 VU, poucas iterações. Valida que os scripts e o alvo funcionam
// ANTES de rodar carga de verdade. Não mede capacidade; só sanidade.
//   k6 run smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, authHeaders, login } from './lib.js';

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_failed: ['rate==0'], // no smoke, nada pode falhar
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  const health = http.get(`${BASE_URL}/health/live`, { tags: { name: 'health' } });
  check(health, { 'health 200': (r) => r.status === 200 });

  const deliveries = http.get(
    `${BASE_URL}/deliveries?pageSize=50`,
    authHeaders(data.token, { tags: { name: 'deliveries' } }),
  );
  check(deliveries, { 'deliveries 200': (r) => r.status === 200 });

  sleep(1);
}
