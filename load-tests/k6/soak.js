// Teste de ENDURANCE (soak) — carga moderada e CONSTANTE por bastante tempo.
// Objetivo: detectar degradação lenta — vazamento de memória, conexões que não
// voltam ao pool, crescimento de latência ao longo das horas. Rode e acompanhe
// as métricas do serviço (memória/RSS, conexões do Postgres) em paralelo.
//   k6 run soak.js                 (30 min por padrão)
//   k6 run -e DURATION=2h -e VUS=15 soak.js
import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, authHeaders, login } from './lib.js';

const VUS = Number(__ENV.VUS || 15);
const DURATION = __ENV.DURATION || '30m';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    // Numa carga constante e moderada, a latência deve ficar ESTÁVEL. Se a p95
    // sobe ao longo do tempo, é sinal de degradação (o gráfico conta a história).
    'http_req_duration{name:deliveries}': ['p(95)<600'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  const res = http.get(
    `${BASE_URL}/deliveries?pageSize=50`,
    authHeaders(data.token, { tags: { name: 'deliveries' } }),
  );
  check(res, { 'deliveries 200': (r) => r.status === 200 });
  sleep(2);
}
