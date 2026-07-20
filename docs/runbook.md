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

## Deploy, rollback e zero-downtime (Render)

A produção roda no **Render** (Frankfurt/UE): serviços `navix-api`, `navix-worker` e `navix-web`, definidos em [`infra/render/render.yaml`](../infra/render/render.yaml).

**Deploy** — automático a cada push na `main` (após a CI passar). O Render faz **rolling deploy zero-downtime**: sobe a nova versão, só corta o tráfego para ela **depois** que o health check (`/api/v1/health/live`) passa.

**Rollback automático** — se o deploy novo falha no health check, o Render **mantém a versão antiga** no ar (o deploy falho nunca recebe tráfego).

**Rollback manual** (reverter um deploy ruim que passou no health mas está com bug):
1. Render → serviço → aba **Events/Deploys** → localize o último deploy bom.
2. **Rollback to this deploy** → o Render reimplanta aquela imagem.
3. Confirme: `curl -s -o /dev/null -w "%{http_code}" https://navix-api.onrender.com/api/v1/health/live` → `200`.

> Se o problema for de **migração de banco** (schema já mudou), rollback de código **não basta** — ver "Migrações" abaixo.

## Migrações de banco

As migrações rodam com o **owner** (não o role de runtime). Regra de ouro: **toda migração deve ser retrocompatível** com a versão de código anterior (expand/contract), para o rolling deploy não quebrar durante a janela em que as duas versões coexistem.
- **Adicionar** coluna/tabela: seguro (a versão antiga ignora).
- **Remover/renomear**: fazer em **dois deploys** (primeiro para de usar; depois remove).
- Rollback de código com migração já aplicada: só reverta a migração se ela for destrutiva e o `down` for seguro; senão, corrija para frente (roll-forward).

## Notificação de alertas → Slack/Discord

As regras ([alerts.yml](../docker/observability/alerts.yml)) são avaliadas pelo Prometheus e roteadas ao Alertmanager ([alertmanager.yml](../docker/observability/alertmanager.yml)). Sem receiver, os alertas ficam visíveis nas UIs (:9090/alerts, :9093) mas **não são enviados**.

**Ligar o Slack** — o receiver já está wired em `alertmanager.yml` (lê a URL de um arquivo montado, `api_url_file`); falta só o segredo:
1. No Slack: crie um **Incoming Webhook** (apps.slack.com → Incoming Webhooks) → copie a URL.
2. Cole a URL (uma linha) em **`docker/observability/secrets/slack_webhook_url`** — é **gitignored**, não vai ao repositório. Base: `slack_webhook_url.example`.
3. Ajuste o `channel` em `alertmanager.yml` se necessário.
4. Suba/reinicie: `docker compose -f docker/observability/docker-compose.observability.yml up -d alertmanager`.
5. Teste o envio (sem esperar um incidente):
   ```bash
   docker exec navix-alertmanager amtool alert add \
     alertname=TesteSlack severity=critical --alertmanager.url=http://localhost:9093
   ```
   → deve cair no seu canal. Depois `amtool alert` para ver/expirar.

**Discord:** mesma ideia com `discord_configs` (ou o webhook do Discord com `/slack` no fim, que aceita o formato Slack).

**Camada nativa do Render** (complementar): Render → **Settings → Notifications** envia e-mail/Slack em **deploy falho** e **serviço unhealthy** — ligue isso já, independe do Prometheus.

## Backup / Restore / DR (Postgres gerenciado — Neon)

O banco é o **Neon** (Postgres gerenciado, UE), com **backup contínuo / Point-in-Time Restore (PITR)** dentro da janela de retenção do plano — sem cron de `pg_dump` para manter.

**Restore (PITR via branch — o caminho recomendado do Neon):**
1. Neon Console → projeto → **Branches** → **Create branch** → **From a point in time** → escolha o timestamp (ex.: minutos antes do incidente).
2. O branch tem uma **connection string própria**. Valide os dados nele (é uma cópia isolada — não afeta produção).
3. Se estiver correto: aponte o `navix-api`/`navix-worker` para a connection string do branch (env no Render) **ou** promova o branch. Redeploy.

**Restore validado (rode trimestralmente — o backup que nunca foi restaurado não existe):**
1. Crie um branch PITR de ~1h atrás.
2. Conecte e confira contagens: `SELECT count(*) FROM deliveries; SELECT max(created_at) FROM audit_log;`.
3. Confirme que os dados batem com o esperado; descarte o branch.
4. Registre a data do teste.

**Última validação:** 2026-07-19 — branch PITR restaurado com sucesso (7 users, 23 audit_log, último audit 14:39 UTC). Dados íntegros; a trilha de auditoria confirma que o writer grava em produção. Próximo drill: ~2026-10.

**DR (perda total da região):** Neon e Render são UE/Frankfurt. Um plano de DR cross-região é backlog — hoje o RPO/RTO é o do PITR do Neon. Documente o RPO aceito com o negócio.

## Rotação de segredos (Render)

O Render **não** tem rotação automática (diferente do AWS Secrets Manager). É um procedimento **manual/agendado** — os segredos vivem em env vars por serviço (idealmente num **Environment Group** compartilhado por api/worker).

**Chaves JWT — rotação SEM downtime** (o app suporta chave anterior, ADR de rotação):
1. Gere um novo par RS256 + um novo `JWT_KEY_ID`.
2. Mova a chave **pública atual** para `JWT_PREVIOUS_PUBLIC_KEY` e o kid atual para `JWT_PREVIOUS_KEY_ID`.
3. Ponha o novo par em `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`/`JWT_KEY_ID`.
4. Redeploy. **Tokens novos** usam a chave nova; **tokens em voo** (assinados com a antiga) seguem válidos até expirar (o app valida pelo `kid`). Sem logout em massa.
5. Depois de passado o TTL do access token (15 min), remova a chave anterior.

**Outros segredos** (`MEDIA_URL_SECRET`, `ENCRYPTION_KEK`, senha do DB): rotação exige cuidado — `MEDIA_URL_SECRET` invalida URLs de POD assinadas em voo (baixo impacto, expiram rápido); `ENCRYPTION_KEK` exige re-encriptação se houver dado cifrado. Agende e documente o impacto antes.

> ⚠️ Todos os segredos obrigatórios em produção são validados no **boot** (ADR-0052): se você apagar/errar um na rotação, a API **não sobe** — o rollback do Render segura a versão anterior. Rode a rotação fora de pico.

## Status page

Ainda **não configurada**. Opções, em ordem de esforço:
- **Nativa do Render:** o painel já mostra o status dos serviços (interno).
- **Hospedada** (Instatus/BetterStack/Statuspage): monitora `https://navix-api.onrender.com/api/v1/health/live` e publica uma página pública `status.navix.*` — o que os clientes esperam ver. Recomendado para o piloto B2B.
- Configure o monitor para **checar `/health/live` a cada 1 min** e alertar junto com o Prometheus.
