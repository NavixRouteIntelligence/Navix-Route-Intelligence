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
