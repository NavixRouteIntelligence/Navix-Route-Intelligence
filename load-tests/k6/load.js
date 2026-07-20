// Teste de CARGA — tráfego esperado em operação normal. Sobe até um patamar de
// VUs, sustenta, e desce. Mede latência (p95/p99), throughput e taxa de erro.
// Os thresholds abaixo são um SLO de referência — falha o teste se estourar.
//   k6 run load.js                (patamar padrão)
//   k6 run -e VUS=50 load.js      (ajusta o pico)
import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, authHeaders, login } from './lib.js';

const PEAK = Number(__ENV.VUS || 20);

export const options = {
  scenarios: {
    carga: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: PEAK }, // sobe
        { duration: '2m', target: PEAK }, // sustenta
        { duration: '30s', target: 0 }, // desce
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // SLO de leitura: 95% < 500ms, 99% < 1s.
    'http_req_duration{name:deliveries}': ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'], // < 1% de erro
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  // Perfil realista: a leitura de entregas é a chamada mais comum na operação.
  const res = http.get(
    `${BASE_URL}/deliveries?pageSize=50`,
    authHeaders(data.token, { tags: { name: 'deliveries' } }),
  );
  check(res, { 'deliveries 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1); // think time 1–3s (usuário real não martela)
}
