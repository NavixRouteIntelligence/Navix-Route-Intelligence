# Runbook Operacional — Navix Route Intelligence

> **Status:** Vivo · **Versão:** 0.1 · **Atualizado:** 2026-07-17 · Ver [ADR-0057](./decisions.md)

Guia de resposta a incidentes. Cada alerta do Prometheus ([alerts.yml](../docker/observability/alerts.yml)) aponta, via `runbook_url`, para a seção correspondente aqui: **sintoma → diagnóstico → ação**.

Este runbook cobre o que é conhecido hoje. Itens que dependem da infraestrutura de produção (provider, backup gerenciado, on-call formal) estão marcados **⬜ pós-R2**.

---

## 0. Primeiros comandos (triagem)

```bash
# Saúde da API (liveness / readiness)
curl -s http://<host>:3001/api/v1/health/live
curl -s http://<host>:3001/api/v1/health/ready

# Métricas cruas (o que o Prometheus vê)
curl -s http://<host>:3001/metrics | grep -E 'http_server_requests_total|process_resident'

# Alertas ativos
#   Prometheus:   http://<host>:9090/alerts
#   Alertmanager: http://<host>:9093
```

- **live** falha → o processo está travado/morto: reiniciar.
- **ready** falha mas **live** ok → dependência indisponível (Postgres/Redis): ver §Dependências.

---

## NavixApiDown

**Sintoma:** o Prometheus não consegue coletar `/metrics` (`up == 0`) por 1 min. (`NavixApiAbsent` é a variante "nenhum alvo configurado".)

**Diagnóstico**
1. `curl /api/v1/health/live` — responde?
2. Logs do processo: erro de boot? Em produção, **config obrigatória ausente derruba o boot** de propósito (ADR-0052) — procure `Configuração inválida para produção` (falta `JWT_*`, `MEDIA_URL_SECRET`, `DB_APP_PASSWORD` padrão, `DB_SSL`).
3. O alvo do scrape aponta para o host/porta certos? (`prometheus.yml`)

**Ação**
- Boot falhando por config → provisionar a variável faltante e reimplantar.
- Processo morto sem causa clara → reiniciar; se reincidir, ver `NavixApiHighMemory`.
- Só o scrape quebrado (API de pé) → corrigir o target; não é incidente de usuário.

---

## NavixApiHighErrorRate

**Sintoma:** > 5% das respostas são 5xx por 5 min (com piso de tráfego).

**Diagnóstico**
1. Quais rotas? `sum by (route,status_code) (rate(http_server_requests_total{status_code=~"5.."}[5m]))`.
2. Logs (pino, JSON) filtrando `res.statusCode>=500` — a mensagem de erro aponta a causa.
3. Concentrado em uma rota → bug/deploy recente. Espalhado → dependência (banco/Redis) ou saturação.

**Ação**
- Correlato a um deploy → **rollback** (⬜ pós-R2: procedimento formal).
- Banco/Redis instável → ver §Dependências.
- Pico de carga → ver `NavixApiEventLoopLag`.

---

## NavixApiHighLatencyP95

**Sintoma:** p95 da latência HTTP > 1s por 5 min.

**Diagnóstico**
1. Rota específica? `histogram_quantile(0.95, sum by (le,route) (rate(http_server_request_duration_seconds_bucket[5m])))`.
2. Cruzar com `NavixApiEventLoopLag` (CPU) e `NavixOptimizerSlow` (solver).
3. Latência de banco: traces do OTel (Jaeger), se habilitado (`OTEL_ENABLED=true`).

**Ação**
- Event loop travado → mover otimização para worker dedicado (`OPTIMIZER_QUEUE_DRIVER=bullmq`, ADR-0055).
- Query lenta → revisar índices/plano; verificar contenção no Postgres.
- Provider de mapas lento → cai em Haversine automaticamente (ADR-0027); confirmar.

---

## NavixApiRateLimitingSpike

**Sintoma:** muitas respostas 429 (> 1 req/s) por 10 min.

**Diagnóstico**
1. Um cliente/IP ou geral? `sum by (route) (rate(http_server_requests_total{status_code="429"}[5m]))`.
2. Abuso/loop de cliente vs. limite mal calibrado para o tráfego legítimo.

**Ação**
- Abuso → bloquear na borda (⬜ pós-R2: WAF/edge).
- Limite apertado demais → recalibrar o throttler (o rate limiting é distribuído via Redis, ADR-0014).

---

## NavixApiEventLoopLag

**Sintoma:** p99 do lag do event loop > 200ms por 5 min — trabalho CPU-bound segurando o processo.

**Diagnóstico**
- A otimização de rotas roda **in-process por padrão** (`OPTIMIZER_QUEUE_DRIVER=inprocess`): uma otimização grande trava o loop e degrada **todas** as requisições daquela instância.
- Confirmar com `NavixOptimizerSlow` e o volume de jobs.

**Ação**
- Ligar o worker BullMQ dedicado (ADR-0055): `OPTIMIZER_QUEUE_DRIVER=bullmq`, a API com `OPTIMIZER_WORKER_ENABLED=false`, e um processo `npm run start:worker`. A otimização deixa de disputar CPU com o HTTP.
- Escalar horizontalmente a API para diluir a carga.

---

## NavixApiHighMemory

**Sintoma:** RSS acima do teto (default 1.5 GiB) por 10 min.

> O limiar é um **default a calibrar por deploy** — ajuste a ~75-80% do limite de memória do container. Não usamos `heap_used/heap_total` de propósito: essa razão fica ~0.95 no funcionamento normal e geraria ruído.

**Diagnóstico**
1. Crescimento contínuo (vazamento) vs. platô alto (carga real)? `deriv(process_resident_memory_bytes[30m])`.
2. Heap x RSS: `nodejs_heap_size_used_bytes` vs `process_resident_memory_bytes`.

**Ação**
- Vazamento → capturar heap snapshot, reiniciar para mitigar, investigar.
- Carga legítima → aumentar o limite do container ou escalar horizontalmente.

---

## NavixOptimizerSlow

**Sintoma:** p95 da resolução do solver > 2s por 10 min.

**Diagnóstico**
1. Tamanho das rotas: `histogram_quantile(0.95, rate(optimizer_route_stops_bucket[10m]))` — n grande domina o custo.
2. Provider de mapas externo (Mapbox) degradado? Falhas caem em Haversine (ADR-0027).

**Ação**
- Rotas muito grandes → revisar limites de paradas por rota; considerar estratégia mais barata.
- Provider externo lento → confirmar o fallback ativo.

---

## NavixOptimizerCapacityInfeasible

**Sintoma:** otimizações falhando por demanda > capacidade do veículo (recorrente por 15 min). Severidade **info**.

**Diagnóstico**
- Perfis de frota (capacidade) mal cadastrados, ou demanda das entregas subestimada.

**Ação**
- Revisar `VEHICLE_CAPACITY_DEFAULTS` e os perfis de veículo do tenant.
- Não é incidente de disponibilidade — é qualidade de dado/produto.

---

## Dependências (Postgres / Redis)

**Postgres indisponível** → `ready` falha, 5xx generalizado. A app conecta via role de runtime não-owner (RLS). Verificar conectividade, conexões saturadas, RLS.

**Redis indisponível** → **degradação graciosa por design** (não é incidente crítico):
- Rate limiting cai para storage em memória (ADR-0014).
- Cache vira miss.
- Realtime (SSE) e tickets caem para in-process — **quebra multi-instância** (ADR-0040/0053): com Redis fora e múltiplas réplicas, o rastreamento ao vivo falha. Restaurar o Redis é prioridade se houver mais de uma instância.
- Fila BullMQ (se `bullmq`) para de processar até o Redis voltar; os jobs persistidos são retomados.

---

## Notificação de alertas (⬜ pós-R2)

As regras são avaliadas pelo Prometheus e roteadas ao Alertmanager ([alertmanager.yml](../docker/observability/alertmanager.yml)). O **canal real** (Slack/PagerDuty) é preenchido no deploy — depende de webhook/credenciais que não moram no repositório. Sem receiver, os alertas ficam visíveis nas UIs (:9090/alerts, :9093) mas não são enviados.

Para ligar o Slack: exportar `SLACK_WEBHOOK_URL` no ambiente do Alertmanager e descomentar o receiver `slack` em `alertmanager.yml`.

## Backup / Restore / DR (⬜ pós-R2)

Depende do Postgres gerenciado do provider a ser escolhido (auditoria 5, R2). O procedimento de backup automatizado **com restore testado** e o DR entram junto com a IaC.
