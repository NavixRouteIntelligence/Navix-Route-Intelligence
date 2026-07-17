# Observabilidade — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.1 · **Atualizado:** 2026-07-14

Os três pilares de observabilidade da API (ADR-0021), pensados para produção e
sem alterar regras de negócio: **logs estruturados**, **métricas** e **tracing
distribuído**, mais **health checks**. Toda a instrumentação é transversal
(logger, interceptor, health) — nenhum caso de uso de domínio muda.

## 1. Visão geral

| Pilar | Como | Exposição | Backend sugerido |
|-------|------|-----------|------------------|
| **Logs** | `nestjs-pino` (JSON), redaction de segredos, `requestId` por request | stdout | Loki / ELK |
| **Métricas** | `prom-client` (Registry dedicado) + interceptor HTTP | `GET /metrics` (Prometheus) | Prometheus + Grafana |
| **Tracing** | OpenTelemetry NodeSDK + auto-instrumentação (http/express/pg/ioredis) | OTLP (opt-in) | Jaeger / Tempo |
| **Health** | `@nestjs/terminus` | `GET /api/v1/health/{live,ready}` | Probes do orquestrador |

## 2. Logs estruturados

- **JSON** em produção (pino); `pino-pretty` só em desenvolvimento.
- Cada requisição recebe um **`requestId`** (respeita `x-request-id` de entrada; senão gera UUID) e o devolve no header `x-request-id`.
- **Redaction**: `authorization`, `cookie`, `x-api-key`, `req.body.password` e `req.body.refreshToken` nunca são logados (ver [security.md](./security.md)).
- **Correlação com traces**: quando o tracing está ativo, cada log carrega `trace_id`/`span_id`, permitindo pular de um log para o trace correspondente (e vice-versa) no Grafana/Jaeger.

## 3. Métricas (Prometheus)

- Endpoint **`GET /metrics`** (fora do prefixo `/api`, sem versão — caminho de scrape padrão).
- **Métricas padrão de processo/Node**: CPU, memória (`process_resident_memory_bytes`), event loop lag, GC, handles.
- **Métricas de HTTP** (via `HttpMetricsInterceptor`, puramente observacional):
  - `http_server_requests_total{method,route,status_code}` — contador.
  - `http_server_request_duration_seconds{method,route,status_code}` — histograma (buckets 10ms→10s).
  - A label **`route` usa o template** (`/deliveries/:id`), não a URL concreta — evita explosão de cardinalidade.
- Label global `service` (de `OTEL_SERVICE_NAME`).

> **Segurança:** `/metrics` é público no app. Em produção, **restrinja por rede/ingress** (ou um sidecar) — não exponha à internet.

## 4. Tracing distribuído (OpenTelemetry)

- **Opt-in**: só inicializa com `OTEL_ENABLED=true` (precisa de um coletor OTLP). Desligado, é **no-op total** — nenhuma instrumentação é aplicada, nada muda no comportamento (default em dev/test).
- **Bootstrap antes de tudo**: `main.ts` importa `./observability/instrument` como **primeiro import** (efeito colateral), garantindo que o OTel instrumente `http`/`express`/`pg`/`ioredis` antes de serem carregados.
- **Propagação de contexto** W3C (`traceparent`) ponta a ponta; spans de entrada HTTP, queries Postgres e comandos Redis saem automaticamente.
- **Exportador**: OTLP/HTTP; endpoint em `OTEL_EXPORTER_OTLP_ENDPOINT` (padrão `http://localhost:4318`).
- Flush no shutdown (`beforeExit`).

## 5. Health checks

- **`GET /api/v1/health/live`** — liveness: o processo está de pé (não toca dependências). Use como *livenessProbe*.
- **`GET /api/v1/health/ready`** — readiness: `200` quando apto a servir. **Postgres é dependência dura** (falha → `503`). **Redis é reportado mas não derruba a prontidão** — é degradável (rate limiting cai para memória, cache vira miss), então aparece como `up` com `connection: up|degraded`. Use como *readinessProbe*.

## 6. Stack local (Prometheus + Grafana + Jaeger)

```bash
docker compose -f docker/observability/docker-compose.observability.yml up -d
```

| Serviço | URL | Notas |
|---------|-----|-------|
| Grafana | http://localhost:3002 | admin/admin; datasources (Prometheus + Jaeger) e dashboard "Navix API" provisionados |
| Prometheus | http://localhost:9090 | faz scrape de `host.docker.internal:3001/metrics` |
| Jaeger UI | http://localhost:16686 | recebe traces OTLP em `:4318` |

Para enviar traces à stack, rode a API com:

```bash
OTEL_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm run start:dev -w apps/api
```

O dashboard inicial (`docker/observability/grafana/dashboards/navix-api.json`) traz RPS por rota, latência p95, taxa de erro 5xx e memória do processo.

## 6.1 Alertas (ADR-0057)

Regras de alerta em [`docker/observability/alerts.yml`](../docker/observability/alerts.yml), avaliadas pelo Prometheus e roteadas ao **Alertmanager** ([`alertmanager.yml`](../docker/observability/alertmanager.yml)). Cobrem disponibilidade (`up`), 5xx, latência p95, 429, event loop, memória e o solver — todas ancoradas em métricas reais de `/metrics`. Cada alerta aponta para a seção correspondente do **[runbook](./runbook.md)** (sintoma → diagnóstico → ação).

O **canal de notificação** (Slack/PagerDuty) é preenchido no deploy — depende de webhook/credenciais fora do repositório. Sem receiver, os alertas ficam visíveis nas UIs (`:9090/alerts`, `:9093`) mas não são enviados.

## 7. Produção (K8s)

- **Métricas**: `ServiceMonitor`/scrape apontando para `/metrics`; regras de alerta prontas em `alerts.yml` (§6.1).
- **Tracing**: `OTEL_ENABLED=true` + `OTEL_EXPORTER_OTLP_ENDPOINT` para um **OpenTelemetry Collector** (que fan-out para Tempo/Jaeger/vendor).
- **Logs**: coletados do stdout (Loki/ELK); correlacionáveis por `trace_id`.
- **Probes**: `livenessProbe` → `/api/v1/health/live`; `readinessProbe` → `/api/v1/health/ready`.

## Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-14 | 0.1 | Arquitetura | Observabilidade de produção: OTel, logs estruturados, métricas Prometheus, health checks, stack Grafana/Jaeger (ADR-0021) |
