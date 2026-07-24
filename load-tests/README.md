# Testes de carga (k6)

Cenários de **carga, stress, endurance e benchmark de otimização** para a API Navix
(Fase 1 — Escalabilidade). Escritos em [k6](https://k6.io).

## Como rodar

Sem instalar k6, via Docker (imagem oficial):

```bash
# a partir da raiz do repo
docker run --rm -i -v "$PWD/load-tests/k6:/scripts" \
  -e BASE_URL=http://host.docker.internal:3001/api/v1 \
  grafana/k6 run /scripts/smoke.js
```

Com o k6 instalado (`brew install k6`):

```bash
cd load-tests/k6
k6 run smoke.js
```

## Alvo

Por padrão aponta para `http://localhost:3001/api/v1` (API local). Para outro alvo:

```bash
k6 run -e BASE_URL=https://navix-api.onrender.com/api/v1 load.js
```

Credenciais (default = usuário do seed local):
`-e NAVIX_EMAIL=... -e NAVIX_PASSWORD=...`

> ⚠️ **Não rode carga/stress contra produção** sem combinar antes. Ideal: um
> ambiente de staging espelhando produção. Contra o local, é seguro.

## Os cenários

| Script | O que faz | Parâmetros (`-e`) |
|---|---|---|
| `smoke.js` | 1 VU, sanidade — valida que scripts e alvo funcionam | — |
| `load.js` | Tráfego esperado; mede p95/p99, throughput, erro. **Tem SLO** | `VUS` (pico, 20) |
| `stress.js` | Sobe em degraus até saturar; **acha o ponto de quebra** | `STEP` (40), `MAX` (200) |
| `soak.js` | Carga constante por horas; detecta vazamento/degradação | `VUS` (15), `DURATION` (30m) |
| `optimize.js` | **Benchmark** do fluxo assíncrono de otimização (POST→poll→plano) | `STOPS` (25), `VUS` (4), `ITER` (30) |
| `mixed.js` | **Cenário misto (R4)**: ingestão de posições + otimizações concorrentes + SSE aberto, medindo p50/p95/p99 por carga e o **ponto de saturação** | `STEP` (20), `MAX` (120), `HOLD_S` (120), `OPT_RATE` (6/min), `SSE_CONNS` (25), `STOPS` (25) |

## Como ler o resultado

- **`http_req_duration`** (p95/p99) — latência. O que o usuário sente.
- **`http_req_failed`** — taxa de erro. Deve ficar < 1% sob carga normal.
- **`iterations` / `http_reqs`** — throughput (req/s no resumo).
- **`optimize_e2e_ms`** (só no `optimize.js`) — tempo ponta a ponta da otimização.
- Um **✓/✗** ao lado de cada threshold diz se o SLO passou.

**Stress:** observe em qual degrau a p95 dispara e o erro sobe — esse é o teto de
capacidade daquela topologia (nº de instâncias/CPU). É o número que sustenta um SLA.

## Ambiente sugerido para números confiáveis

O `optimize.js` é dominado pela fila. Para medir a otimização sob volume real,
rode a API com `OPTIMIZER_QUEUE_DRIVER=bullmq` e o worker dedicado (ADR-0055),
senão a otimização compete com o event loop da API (o alerta `NavixApiEventLoopLag`
existe justamente para isso).

---

## `mixed.js` — o teste que sustenta um SLA (R4)

Os outros cenários exercitam **uma** carga por vez, e isolada cada uma passa. O
que derruba produção é a **interação**: a otimização consome CPU, o SSE segura
conexões abertas e a ingestão martela o banco — ao mesmo tempo. O `mixed.js`
roda as três juntas e reporta os percentis **separados por carga**.

### Pré-requisito (senão o número não vale)

Rodar contra a **topologia de produção**, com o **worker dedicado de pé**:

| Onde | Configuração |
|------|--------------|
| API | `OPTIMIZER_QUEUE_DRIVER=bullmq` e `OPTIMIZER_WORKER_ENABLED=false` |
| Worker | processo próprio (`node dist/main-worker.js`) com `OPTIMIZER_WORKER_ENABLED=true` |

Na AWS isso é o serviço `worker` do `infra/terraform/ecs.tf`. Com o worker
in-process, a otimização compete com o event loop da API e o teste mede uma
topologia que não é a de produção.

> **Ordem correta:** infraestrutura de produção de pé → `mixed.js` → SLA. Rodar
> antes disso produz um número que não representa nada.

### Desenho do experimento

- **Ingestão** sobe em **degraus** (`STEP` VUs por degrau até `MAX`) — é a carga
  que cresce com o número de motoristas na rua.
- **Otimizações** ficam em **taxa constante** (`OPT_RATE`/min): é a *variável de
  controle*, para que a degradação observada venha do crescimento da ingestão e
  do SSE, não de mais otimizações.
- **SSE** mantém `SSE_CONNS` conexões abertas em paralelo (pressão de memória/FD).

As três cargas duram exatamente o mesmo tempo (derivado dos degraus), então os
degraus finais — onde a saturação aparece — têm concorrência real.

### Como achar o ponto de saturação

```bash
k6 run --out csv=resultado.csv load-tests/k6/mixed.js
```

O resumo final imprime p50/p95/p99 e erro por carga. Para o **ponto de
saturação**, cruze os percentis com o degrau de VUs ao longo do tempo no CSV: o
degrau em que a **p95 da ingestão sai do SLO** ou a **p99 da otimização dispara**
é o teto daquela topologia. Esse é o número que sustenta um SLA — e o gatilho
para subir instâncias (`api_desired_count` / `worker_desired_count`).
