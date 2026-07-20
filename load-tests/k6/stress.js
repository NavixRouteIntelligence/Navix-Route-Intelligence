// Teste de STRESS — sobe a carga em degraus além do esperado para achar o
// PONTO DE SATURAÇÃO (onde a latência dispara ou o erro cresce). Diferente do
// load, aqui NÃO há SLO rígido: o objetivo é descobrir o limite, não passar.
// Observe no resumo em qual degrau a p95 estoura / http_req_failed sobe.
//   k6 run stress.js
//   k6 run -e STEP=50 -e MAX=300 stress.js
import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, authHeaders, login } from './lib.js';

const STEP = Number(__ENV.STEP || 40);
const MAX = Number(__ENV.MAX || 200);

// Degraus crescentes até MAX, 1 min cada.
function stages() {
  const s = [];
  for (let vus = STEP; vus <= MAX; vus += STEP) {
    s.push({ duration: '20s', target: vus }); // rampa
    s.push({ duration: '1m', target: vus }); // sustenta o degrau
  }
  s.push({ duration: '30s', target: 0 });
  return s;
}

export const options = {
  scenarios: {
    stress: { executor: 'ramping-vus', startVUs: 0, stages: stages(), gracefulRampDown: '10s' },
  },
  // Sem threshold de falha — queremos VER o ponto de quebra, não abortar cedo.
  thresholds: {
    http_req_duration: ['p(95)<3000'], // informativo; o resumo mostra o real
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
  sleep(0.5);
}
