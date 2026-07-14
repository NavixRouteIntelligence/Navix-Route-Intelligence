# Arquitetura — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.3 · **Atualizado:** 2026-07-12

Este documento é a fonte de verdade da arquitetura **alvo**. Toda contribuição deve preservar os princípios aqui descritos. Mudanças estruturais exigem um ADR em [decisions.md](./decisions.md).

> **⚠️ Estado da implementação.** Este documento descreve a arquitetura-alvo; nem tudo está construído. **Já implementado:** Clean Architecture + módulos, DDD, multi-tenant com RLS forçada (ADR-0012), auth JWT RS256, PgBouncer, otimizador atrás de port (síncrono), TypeORM + PostGIS. **Ainda roadmap:** comunicação assíncrona/filas (§8), Transactional Outbox e eventos (§8.1), otimização assíncrona (§8.2), CQRS/read models (§8.3), TimescaleDB (§2) e uso do Redis. O estado preciso de cada decisão está na coluna **"Status da implementação"** em [decisions.md](./decisions.md). Onde este documento usa o presente do indicativo para algo ainda não construído, trata-se de **intenção de projeto**, não de fato.

## 1. Princípios

- **Clean Architecture:** dependências apontam sempre para dentro (domínio no centro).
- **DDD:** o código reflete a linguagem ubíqua do negócio logístico.
- **SOLID** e baixo acoplamento (ver [coding-standards.md](./coding-standards.md)).
- **Multi-tenant por padrão:** todo dado e operação é escopado por `tenant_id`.
- **Segurança por design:** ver [security.md](./security.md).
- **Event-driven** onde faz sentido, para desacoplar otimização, ingestão e notificação.

## 2. Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js (LTS) + TypeScript |
| Framework | NestJS |
| ORM | TypeORM (compatível com RLS e PostGIS — ver ADR-0005) |
| Persistência | PostgreSQL 16 + PostGIS |
| Telemetria (posições) | TimescaleDB (hypertables) — ver ADR-0009 · ⬜ *planejado; hoje tabela Postgres comum* |
| Cache / filas / sessões | Redis 7 — 🟡 *ativo no rate limiting; abstrações de cache/fila prontas, não consumidas* |
| Mensageria assíncrona | Filas (BullMQ sobre Redis) — evoluível para broker dedicado · ⬜ *planejado* |
| Auth | JWT (access) + Refresh Token · API keys/OAuth2 client credentials (M2M) |
| Infra | Contêineres (Docker), CI/CD, orquestração a definir em ADR |

> **Pooling:** conexões ao Postgres passam por **PgBouncer** (modo transaction) para suportar milhares de tenants sem esgotar conexões.

## 3. Camadas (Clean Architecture)

```
┌─────────────────────────────────────────────────────────┐
│  Interface / Apresentação                                │
│  Controllers REST, DTOs, validação, guards, filtros      │
├─────────────────────────────────────────────────────────┤
│  Aplicação (Use Cases)                                   │
│  Orquestra regras de negócio, transações, portas         │
├─────────────────────────────────────────────────────────┤
│  Domínio (núcleo)                                        │
│  Entidades, Value Objects, Agregados, Domain Services,   │
│  Eventos de domínio, Interfaces (ports) de repositório   │
├─────────────────────────────────────────────────────────┤
│  Infraestrutura                                          │
│  Repositórios (TypeORM/Prisma), Redis, provedores        │
│  externos (mapas, trânsito), filas, adapters             │
└─────────────────────────────────────────────────────────┘
```

**Regra de dependência:** Interface → Aplicação → Domínio ← Infraestrutura. O domínio não conhece framework, banco nem HTTP. A infraestrutura implementa as *ports* definidas no domínio/aplicação (Dependency Inversion).

## 4. Bounded Contexts (DDD)

| Contexto | Responsabilidade |
|----------|------------------|
| **Identity & Access** | Tenants, usuários, papéis, autenticação, autorização |
| **Fleet** | Veículos, motoristas, capacidades, disponibilidade |
| **Delivery** | Pedidos/entregas, janelas de tempo, prioridades, depósitos |
| **Routing / Optimization** | Motor VRP, matriz de distância, planos de rota |
| **Realtime Tracking** | Posição, telemetria, reotimização dinâmica, ETA |
| **Intelligence** | Modelos de ML, features, previsões, aprendizado contínuo |
| **Billing** | Planos, assinaturas, uso, faturamento |
| **Notifications** | E-mails, push, webhooks, eventos externos |

Cada contexto tende a virar um **módulo NestJS** independente, com seu próprio domínio, casos de uso e infraestrutura. Comunicação entre contextos ocorre por interfaces de aplicação ou eventos, nunca por acesso direto ao banco alheio.

> **Regra de fronteira (inegociável):** um módulo **nunca** lê/escreve tabelas de outro módulo nem importa suas classes internas — apenas *ports* públicas e eventos. Essa disciplina é o que mantém o **monólito modular** extraível para microserviços no futuro sem reescrita. Reforçada por lint de dependências (ver [coding-standards.md](./coding-standards.md)).
>
> **Estado atual do enforcement:** o `eslint-plugin-boundaries` (em `apps/api/.eslintrc.cjs`) já impede as violações **entre camadas** (domain → application/infra/interface, etc.). O **isolamento entre módulos de negócio** (um módulo não importar internals de outro) é hoje mantido por convenção e pelos gateways anti-corrupção — a regra de lint por módulo ainda **não** está configurada. Hoje a comunicação entre contextos é feita por *ports* de aplicação (ex.: Optimizer → Delivery via `DeliveryLookupPort`), **não** por eventos (o outbox é roadmap — §8.1).

**Escopo do MVP (Fases 0–1):** implementar apenas **Identity & Access**, **Fleet**, **Delivery** e **Routing/Optimization**. Realtime Tracking, Intelligence, Billing e Notifications entram nas fases seguintes (ver [roadmap.md](./roadmap.md)) — mas seus contratos já são considerados no design.

## 5. Estrutura de pastas (proposta)

```
src/
  modules/
    identity/
      domain/          # entidades, VOs, ports
      application/     # use cases, DTOs de aplicação
      infrastructure/  # repositórios, adapters
      interface/       # controllers, DTOs HTTP, guards
    fleet/
    delivery/
    routing/
    tracking/
    intelligence/
    billing/
    notifications/
  shared/
    kernel/            # base entities, Result, erros de domínio
    tenancy/           # contexto de tenant, interceptors
    security/          # crypto, jwt, guards comuns
    config/            # configuração tipada e validada
    observability/     # logging, tracing, métricas
  main.ts
```

## 6. Multi-tenancy

**Estratégia inicial:** banco único, **RLS (Row-Level Security)** do PostgreSQL + coluna `tenant_id` em todas as tabelas de negócio.

- No **login** o tenant é resolvido pelo **e-mail** (identidade global) ou pelo **slug** da empresa — sem `tenantId` no corpo (ADR-0016). A resolução ocorre em `users`/`tenants` (sem RLS, fluxo público pré-tenant); daí em diante o `tenant_id` viaja no JWT.
- Um `TenantContext` é resolvido a partir do JWT em cada requisição (interceptor/guard).
- Toda query é automaticamente filtrada por `tenant_id`; RLS atua como rede de segurança no banco.
- Migração futura para **schema-por-tenant** ou **DB-por-tenant** para clientes enterprise/residência de dados é prevista (ver [database.md](./database.md) e registrar ADR ao decidir).

**Regra inviolável:** nenhum caso de uso pode acessar dados sem um `tenant_id` válido no contexto.

## 7. Fluxos principais

### 7.1 Planejamento de rota (Fase 1)
1. Cliente cria entregas e define frota disponível.
2. Use case `PlanRoutes` coleta restrições e solicita matriz de distância/tempo.
3. Motor de otimização (serviço de domínio/infra) resolve o VRP.
4. Plano de rota é persistido e publicado (evento `RoutePlanned`).
5. Motorista consome a sequência otimizada.

### 7.2 Reotimização em tempo real (Fase 2)
1. Ingestão recebe posição/atraso/nova entrega.
2. Evento dispara `ReoptimizeRoute` de forma assíncrona (fila).
3. Novo plano é calculado e diferenças são notificadas (webhook/push).

### 7.3 Inteligência (Fase 3)
1. Eventos de entrega alimentam o pipeline de features.
2. Modelos por tenant preveem ETA/tempo de parada.
3. Previsões realimentam o motor de otimização.

## 8. Comunicação assíncrona e eventos

> **Status:** ⬜ **Planejado.** Não há filas, workers, BullMQ ou dead-letter no código hoje. A otimização roda de forma **síncrona** no request (ver §8.2). Esta seção descreve o alvo para a Fase 2.

- Operações pesadas (otimização, ML, notificações) rodam em **workers** consumindo filas no Redis (BullMQ).
- Idempotência e *retry* com backoff são obrigatórios em consumidores; mensagens sem sucesso vão para **dead-letter**.

### 8.1 Transactional Outbox (ADR-0006)

> **Status:** 🟡 **Parcial (só schema).** A tabela `outbox` existe, mas não há gravação de eventos na transação, relay nem consumidores — nenhum evento é publicado. Ver [decisions.md](./decisions.md) ADR-0006.

Para evitar *dual-write* (gravar estado e publicar evento em operações separadas), eventos de domínio são gravados numa tabela **`outbox`** **na mesma transação** do agregado. Um *relay* assíncrono lê o outbox e publica na fila. Assim, nenhum evento é perdido e nenhum evento é emitido para uma transação que falhou.

```
[Use Case] --tx--> grava Agregado + linha em outbox  (atômico)
[Relay]    ------> lê outbox --> publica na fila --> marca como enviado
[Worker]   ------> consome (idempotente) --> efeito colateral
```

Contratos de evento são versionados e tratados como parte pública do módulo (ex.: `route.planned.v1`).

## 8.2 Motor de otimização (boundary isolável — ADR-0007)

> **Status:** 🟡 **Parcial (avançado).** A otimização é **assíncrona**: o `POST /route-plans` enfileira e responde **`202 Accepted` + `jobId`**; o status vem por `GET /route-plans/jobs/:id` (polling como fallback) **e por SSE em tempo real** — a `JobEventsPort` publica no `RealtimeHub` (ADR-0018). Um processador reusa o solver fora da requisição. A **port de fila** isola o transporte; a implementação atual é **in-process** (não-durável) — a troca por **BullMQ**/worker dedicado é o passo pendente, sem alterar os casos de uso.
>
> **Tempo real (ADR-0018):** transporte servidor→cliente por **SSE** (`/realtime/stream`, autenticado por ticket), com um `RealtimeHub` in-process isolado por tenant. Publicam nele o **Tracking** (`tracking.position`) e os **jobs de otimização** (`optimization.job`). O **polling** permanece só como *fallback*; multi-instância → **Redis pub/sub** (roadmap).

O solver de VRP fica atrás da **port `RouteOptimizer`**, é **stateless** e roda de forma **assíncrona via fila**. No MVP executa como worker in-process; o contrato permite extrair para um **microserviço com escala horizontal** (e até outra linguagem/solver) sem reescrever os casos de uso. A API responde `202 Accepted` com um recurso de job (ver [api.md](./api.md)).

## 8.3 CQRS leve e read models (ADR-0011)

> **Status:** ⬜ **Planejado.** Não há read models, materializações nem réplicas de leitura; dashboards e listagens consultam o OLTP diretamente. Depende do outbox (§8.1).

Escrita permanece normalizada; **read models** (materializações alimentadas por eventos do outbox e servidas por **réplicas de leitura**) atendem dashboards e relatórios de eficiência sem competir com o OLTP. Isso é o que permite relatórios em escala de milhares de tenants.

## 9. Configuração e ambientes

- Configuração **tipada e validada** na inicialização (falha rápida se inválida).
- Segredos nunca no código — via variáveis de ambiente / secret manager (ver [security.md](./security.md)).
- Ambientes: `local`, `staging`, `production`.

## 10. Observabilidade

> ✅ **Implementado (ADR-0021).** Detalhes e stack local em [observability.md](./observability.md).

- **Logs** estruturados (JSON, pino) com `requestId`, redaction de segredos e correlação `trace_id`/`span_id` quando o tracing está ativo.
- **Métricas** de sistema/HTTP expostas em **`GET /metrics`** (Prometheus): RED metrics (`http_server_requests_total`, `http_server_request_duration_seconds`) + métricas de processo. Métricas de negócio (rotas otimizadas, latência do VRP) podem ser adicionadas via `MetricsService`.
- **Tracing** distribuído com **OpenTelemetry** (auto-instrumentação http/pg/ioredis), **opt-in** por `OTEL_ENABLED`, exportando OTLP para Jaeger/Tempo.
- **Health checks**: `GET /api/v1/health/live` (liveness) e `/health/ready` (readiness — Postgres é dependência dura; Redis é reportado, porém não fatal).
- **Prometheus + Grafana + Jaeger** provisionados em `docker/observability/`.

## 11. Qualidade e testes

- Testes de domínio isolados de infraestrutura.
- Testes de integração por módulo.
- Contratos de API testados (ver [api.md](./api.md)).
- Detalhes e metas em [coding-standards.md](./coding-standards.md).

## 12. Metas de escala (design targets)

O sistema é desenhado para evoluir, sem reescrita, até a ordem de:

- **Milhares de tenants** ativos em paralelo (isolamento por RLS + PgBouncer + rate limit por tenant).
- **Milhões de entregas/dia** agregadas (PKs UUIDv7, particionamento, read models).
- **Milhões de pontos de telemetria/dia** (TimescaleDB com compressão e downsampling).
- Otimização escalando **horizontalmente** por workers, isolada por tenant na fila.

Estratégias de crescimento previstas, acionadas por métricas: réplicas de leitura → CQRS/read models → broker de streaming dedicado (Kafka) para ingestão de tracking → schema/DB por tenant para grandes contas → sharding do OLTP para os maiores tenants.

## 13. Decisões resolvidas e em aberto

**Decididas (ADR registrado) — note que "decidida" ≠ "implementada":** ORM (ADR-0005, ✅ implementado), publicação de eventos via outbox (ADR-0006, 🟡 só schema), boundary do otimizador (ADR-0007, 🟡 port pronta / execução síncrona), série temporal de posições (ADR-0009, 🟡 tabela sem TimescaleDB), CQRS/read models (ADR-0011, ⬜ não implementado). Ver o **Status da implementação** de cada uma em [decisions.md](./decisions.md).

**Ainda em aberto (registrar ADR ao resolver):**

- Broker de mensageria dedicado (Kafka/RabbitMQ) vs. BullMQ — gatilho: volume de tracking na Fase 2.
- Estratégia de multi-tenancy para enterprise (schema vs. DB por tenant) — gatilho: primeiro cliente com exigência de residência de dados.
- Extração do otimizador para microserviço dedicado — gatilho: contenção de CPU/latência do solver.
- Orquestração de contêineres (Kubernetes vs. gerenciado).

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial |
| 2026-07-05 | 0.2 | CTO | Outbox, boundary do otimizador, CQRS, PgBouncer, TimescaleDB, regra de fronteira, metas de escala |
| 2026-07-12 | 0.3 | Arquitetura | Callouts de estado da implementação (§2, §8, §8.1–8.3, §13); esclarecimento do enforcement de fronteira (§4) |
