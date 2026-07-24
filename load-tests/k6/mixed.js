// Cenário MISTO — a forma real da operação da Navix, com as três cargas ao
// mesmo tempo, disputando os mesmos recursos:
//
//   1. INGESTÃO de posições  (motoristas na rua, escrita constante — TimescaleDB)
//   2. OTIMIZAÇÕES concorrentes (CPU/fila — BullMQ + worker dedicado)
//   3. Conexões SSE ABERTAS  (cada uma segura um socket e recebe broadcast)
//
// Rodar os três juntos é o ponto: isolados, cada um passa. O que derruba a
// produção é a interação — a otimização come CPU, o SSE segura conexões e a
// ingestão martela o banco. Este script mede p50/p95/p99 de cada carga
// SEPARADAMENTE (tags por operação) e sobe em degraus até achar a SATURAÇÃO.
//
// ⚠️ PRÉ-REQUISITO (senão o número não vale nada): rodar contra a topologia de
// produção — API com OPTIMIZER_QUEUE_DRIVER=bullmq e OPTIMIZER_WORKER_ENABLED=false,
// com o WORKER DEDICADO de pé (ADR-0055). Com o worker in-process, a otimização
// compete com o event loop da API e o resultado mede a topologia errada.
//
//   k6 run mixed.js
//   k6 run -e BASE_URL=https://api.navix.pt/api/v1 -e MAX=240 mixed.js
//   k6 run -e STEP=20 -e MAX=200 -e HOLD_S=180 -e STOPS=40 mixed.js
//   k6 run --out csv=resultado.csv mixed.js     # p/ cruzar percentis x degrau
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

import { BASE_URL, authHeaders, login, makeStops, uuidv4 } from './lib.js';

// --- Parâmetros do degrau ---------------------------------------------------
const STEP = Number(__ENV.STEP || 20); // incremento de VUs por degrau
const MAX = Number(__ENV.MAX || 120); // teto de VUs da ingestão
const HOLD_S = Number(__ENV.HOLD_S || 120); // s sustentando cada degrau
const RAMP_S = 20; // s de rampa entre degraus
const STOPS = Number(__ENV.STOPS || 25); // paradas por otimização
const SSE_CONNS = Number(__ENV.SSE_CONNS || 25); // conexões SSE mantidas abertas
const SSE_HOLD = Number(__ENV.SSE_HOLD || 60); // s que cada conexão fica aberta

// --- Métricas por carga (o resumo global mistura tudo; aqui separamos) ------
const ingestLatency = new Trend('navix_ingest_ms', true);
const optimizeE2E = new Trend('navix_optimize_e2e_ms', true);
const optimizeEnqueue = new Trend('navix_optimize_enqueue_ms', true);
const sseConnectMs = new Trend('navix_sse_connect_ms', true);
const ingestFailed = new Rate('navix_ingest_failed');
const optimizeFailed = new Rate('navix_optimize_failed');
const sseFailed = new Rate('navix_sse_failed');
const optimizeDone = new Counter('navix_optimize_done');

// Degraus crescentes de ingestão: é a carga que cresce com o nº de motoristas.
function ingestStages() {
  const stages = [];
  for (let vus = STEP; vus <= MAX; vus += STEP) {
    stages.push({ duration: `${RAMP_S}s`, target: vus }); // rampa
    stages.push({ duration: `${HOLD_S}s`, target: vus }); // sustenta o degrau
  }
  stages.push({ duration: '30s', target: 0 });
  return stages;
}

// Duração TOTAL da ingestão, em segundos. As outras cargas usam exatamente
// este valor: se terminassem antes, os degraus finais (justamente onde a
// saturação aparece) rodariam sem carga concorrente e o teste mediria outra
// coisa. Derivado dos degraus — acompanha qualquer STEP/MAX/HOLD_S.
const TOTAL_S = Math.floor(MAX / STEP) * (RAMP_S + HOLD_S) + 30;

export const options = {
  scenarios: {
    // 1) Ingestão — cresce em degraus até MAX.
    ingest: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ingestStages(),
      gracefulRampDown: '10s',
      exec: 'ingestPositions',
    },
    // 2) Otimizações — taxa CONSTANTE. Mantida fixa de propósito: assim a
    //    degradação observada vem do aumento da ingestão/SSE, não de mais
    //    otimizações. É a variável de controle do experimento.
    optimize: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.OPT_RATE || 6),
      timeUnit: '1m',
      duration: `${TOTAL_S}s`,
      preAllocatedVUs: 10,
      maxVUs: 40,
      exec: 'optimizeRoute',
    },
    // 3) SSE — conexões abertas em paralelo, renovadas ao expirar.
    sse: {
      executor: 'constant-vus',
      vus: SSE_CONNS,
      duration: `${TOTAL_S}s`,
      exec: 'holdSse',
    },
  },
  // SLOs de referência. O objetivo do teste é ACHAR o ponto de saturação, então
  // os thresholds não abortam a execução (abortOnFail fica desligado) — servem
  // como marcador visual de onde o sistema saiu do aceitável.
  thresholds: {
    'navix_ingest_ms': ['p(50)<200', 'p(95)<800', 'p(99)<2000'],
    'navix_optimize_e2e_ms': ['p(50)<3000', 'p(95)<15000', 'p(99)<30000'],
    'navix_sse_connect_ms': ['p(95)<1000'],
    'navix_ingest_failed': ['rate<0.01'],
    'navix_optimize_failed': ['rate<0.02'],
    'navix_sse_failed': ['rate<0.02'],
  },
};

export function setup() {
  return { token: login() };
}

// ===== 1) INGESTÃO DE POSIÇÕES =============================================
// Um motorista real manda posição a cada poucos segundos. Alterna envio único
// e lote (o app tem fila offline: ao recuperar sinal, descarrega em batch).
export function ingestPositions(data) {
  const useBatch = Math.random() < 0.25; // 1 em 4 é descarga de fila offline
  const point = () => ({
    latitude: 38.72 + (Math.random() - 0.5) * 0.12,
    longitude: -9.14 + (Math.random() - 0.5) * 0.12,
    speed: Math.random() * 90,
    heading: Math.random() * 360,
    recordedAt: new Date().toISOString(),
    status: 'en_route',
  });

  let res;
  if (useBatch) {
    const positions = Array.from({ length: 10 }, point);
    res = http.post(
      `${BASE_URL}/tracking/positions/batch`,
      JSON.stringify({ positions }),
      authHeaders(data.token, { tags: { op: 'ingest_batch' } }),
    );
  } else {
    res = http.post(
      `${BASE_URL}/tracking/positions`,
      JSON.stringify(point()),
      authHeaders(data.token, { tags: { op: 'ingest' } }),
    );
  }

  const ok = check(res, { 'ingest 2xx': (r) => r.status >= 200 && r.status < 300 });
  ingestLatency.add(res.timings.duration);
  ingestFailed.add(ok ? 0 : 1);

  sleep(Math.random() * 3 + 2); // motorista envia a cada ~2–5s
}

// ===== 2) OTIMIZAÇÕES CONCORRENTES =========================================
// Fluxo assíncrono real: POST 202 + jobId → poll até succeeded. Mede o tempo
// ponta a ponta, que é o que o motorista sente ao pedir "Reorganizar Rota".
export function optimizeRoute(data) {
  const started = Date.now();
  const post = http.post(
    `${BASE_URL}/route-plans`,
    JSON.stringify({ stops: makeStops(STOPS) }),
    authHeaders(data.token, { 'Idempotency-Key': uuidv4(), tags: { op: 'optimize_enqueue' } }),
  );
  optimizeEnqueue.add(post.timings.duration);

  if (!check(post, { 'enqueue 202': (r) => r.status === 202 })) {
    optimizeFailed.add(1);
    return;
  }
  const jobId = post.json('data.jobId');

  // Poll com teto: sob saturação o job demora — é exatamente o que queremos ver.
  let status = 'queued';
  for (let i = 0; i < 120; i++) {
    sleep(0.5);
    const job = http.get(
      `${BASE_URL}/route-plans/jobs/${jobId}`,
      authHeaders(data.token, { tags: { op: 'optimize_poll' } }),
    );
    if (job.status !== 200) continue;
    status = job.json('data.status');
    if (status === 'succeeded' || status === 'failed') break;
  }

  const ok = status === 'succeeded';
  optimizeFailed.add(ok ? 0 : 1);
  if (ok) {
    optimizeE2E.add(Date.now() - started);
    optimizeDone.add(1);
  }
  check(null, { 'otimização concluída': () => ok });
}

// ===== 3) CONEXÕES SSE ABERTAS =============================================
// O painel da empresa mantém o stream aberto o tempo todo. Cada conexão segura
// um socket no servidor e recebe todo broadcast do tenant — é pressão de
// memória/FD que só aparece com muitas conexões simultâneas.
//
// NOTA: usamos http.get com timeout longo em vez de um módulo SSE. É proposital
// — lib.js é self-contained e assim o script roda em qualquer versão do k6. O
// custo é não parsear evento a evento: medimos o ESTABELECIMENTO da conexão
// (navix_sse_connect_ms) e a mantemos aberta pelo tempo de HOLD, que é a
// pressão que interessa. A latência do hold é tagueada à parte (op:sse_stream)
// para não poluir os percentis das outras cargas.
export function holdSse(data) {
  // O stream é autenticado por ticket curto (não por Bearer) — ver ADR-0053.
  const t0 = Date.now();
  const ticketRes = http.post(
    `${BASE_URL}/realtime/ticket`,
    null,
    authHeaders(data.token, { tags: { op: 'sse_ticket' } }),
  );
  const gotTicket = check(ticketRes, { 'ticket 200': (r) => r.status === 200 });
  if (!gotTicket) {
    sseFailed.add(1);
    sleep(5);
    return;
  }
  sseConnectMs.add(Date.now() - t0);

  const ticket = ticketRes.json('ticket');
  const stream = http.get(`${BASE_URL}/realtime/stream?ticket=${ticket}`, {
    timeout: `${SSE_HOLD}s`, // segura a conexão aberta
    tags: { op: 'sse_stream' },
  });

  // Timeout aqui é SUCESSO: significa que a conexão ficou aberta o tempo todo.
  // Falha real é o servidor derrubar antes (status 0 sem corpo, 5xx, 401).
  const held = stream.status === 200 || stream.status === 0;
  sseFailed.add(held ? 0 : 1);
  check(stream, { 'sse manteve a conexão': () => held });
}

// Resumo com os percentis que interessam, lado a lado por carga.
export function handleSummary(data) {
  const m = data.metrics;
  const pct = (name, p) => {
    const v = m[name] && m[name].values[p];
    return v === undefined ? '—' : `${Math.round(v)}ms`;
  };
  const rate = (name) => {
    const v = m[name] && m[name].values.rate;
    return v === undefined ? '—' : `${(v * 100).toFixed(2)}%`;
  };

  const linhas = [
    '',
    '=== Navix — cenário misto (ingestão + otimização + SSE) ===',
    '',
    'Carga          |      p50 |      p95 |      p99 |   erro',
    '---------------+----------+----------+----------+--------',
    `Ingestão       | ${pct('navix_ingest_ms', 'p(50)').padStart(8)} | ${pct('navix_ingest_ms', 'p(95)').padStart(8)} | ${pct('navix_ingest_ms', 'p(99)').padStart(8)} | ${rate('navix_ingest_failed').padStart(6)}`,
    `Otimização e2e | ${pct('navix_optimize_e2e_ms', 'p(50)').padStart(8)} | ${pct('navix_optimize_e2e_ms', 'p(95)').padStart(8)} | ${pct('navix_optimize_e2e_ms', 'p(99)').padStart(8)} | ${rate('navix_optimize_failed').padStart(6)}`,
    `SSE (conexão)  | ${pct('navix_sse_connect_ms', 'p(50)').padStart(8)} | ${pct('navix_sse_connect_ms', 'p(95)').padStart(8)} | ${pct('navix_sse_connect_ms', 'p(99)').padStart(8)} | ${rate('navix_sse_failed').padStart(6)}`,
    '',
    `Otimizações concluídas: ${(m.navix_optimize_done && m.navix_optimize_done.values.count) || 0}`,
    '',
    'PONTO DE SATURAÇÃO: cruze estes percentis com o degrau de VUs no tempo',
    '(--out csv=resultado.csv). O degrau em que a p95 da ingestão sai do SLO',
    'ou a p99 da otimização dispara é o teto daquela topologia.',
    '',
  ].join('\n');

  return {
    stdout: linhas,
    'mixed-summary.json': JSON.stringify(data, null, 2),
  };
}
