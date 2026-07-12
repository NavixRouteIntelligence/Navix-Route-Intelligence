# Banco de dados — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.3 · **Atualizado:** 2026-07-12

> **⚠️ Estado da implementação.** Este documento mistura o modelo **atual** com o modelo **alvo**. **Tabelas que existem hoje** (via migrações): `tenants`, `roles`, `users`, `user_roles`, `refresh_tokens`, `api_keys`, `audit_log`, `outbox`, `password_reset_tokens`, `vehicles`, `drivers`, `deliveries`, `route_plans`, `import_batches`, `driver_positions`, `proof_of_delivery`, `user_settings`, `user_profiles`. **Ainda não existem** (roadmap): `depots`, `routes`, `route_stops`, read models (ex.: `tenant_efficiency_daily`), tabelas de Intelligence e Billing. **TimescaleDB** não está habilitado (posições em tabela comum). **Redis** está provisionado mas **sem uso no código**. **Criptografia de coluna (AES-256/DEK por tenant)** ainda **não** existe — PII está em texto puro. Cada item é rastreado na coluna "Status da implementação" em [decisions.md](./decisions.md).

## 1. Tecnologias

| Uso | Tecnologia |
|-----|-----------|
| Dados relacionais / geoespaciais | PostgreSQL 16 + **PostGIS** |
| Telemetria (série temporal) | **TimescaleDB** (extensão do Postgres) — ver ADR-0009 · ⬜ *planejado (hoje tabela comum)* |
| Cache, filas, sessões, rate limit | **Redis 7** · 🟡 *ativo no rate limiting; cache/filas com abstração pronta, ainda não consumidas* |
| ORM / migrações | **TypeORM** (ADR-0005), migrações versionadas e automatizadas |
| Pooling de conexões | **PgBouncer** (modo transaction) |

**PostGIS** é essencial: coordenadas, geometrias de rota, cálculo de proximidade e consultas espaciais.

## 2. Princípios de modelagem

- Toda tabela de negócio possui **`tenant_id`** (multi-tenancy — ver [architecture.md](./architecture.md)).
- Chaves primárias **UUIDv7** — ordenáveis por tempo, evitam enumeração e preservam *locality* de índice em escala (ver ADR-0008). UUIDv4 é evitado por fragmentar índices B-tree em milhões de linhas.
- Timestamps `created_at` / `updated_at` em todas as tabelas; *soft delete* com `deleted_at` onde aplicável.
- Nomes de tabela em `snake_case`, plural; colunas em `snake_case`.
- Integridade referencial via *foreign keys*; índices em toda FK e em colunas de filtro frequente.
- Dados sensíveis criptografados em repouso (AES-256 — ver [security.md](./security.md)).

## 3. Multi-tenancy no banco

**Estratégia inicial:** banco único + coluna `tenant_id` + **Row-Level Security (RLS)**.

```sql
-- Exemplo de política RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON deliveries
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

- A aplicação define `SET app.current_tenant` por conexão/transação a partir do `TenantContext`.
- RLS é a **rede de segurança**; a aplicação também filtra explicitamente.
- Evolução para schema/DB por tenant (enterprise/residência de dados) → registrar ADR.

## 4. Modelo de dados (visão inicial)

> Esquema preliminar. Ajustar conforme os bounded contexts amadurecem.

### Identity & Access
- **tenants** — `id`, `name`, `plan`, `region`, `status`, timestamps.
- **users** — `id`, `tenant_id`, `email` (único por tenant), `password_hash`, `status`, timestamps.
- **roles** — `id`, `tenant_id`, `name`.
- **user_roles** — `user_id`, `role_id`.
- **refresh_tokens** — `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`.
- **api_keys** — `id`, `tenant_id`, `name`, `key_hash`, `scopes`, `last_used_at`, `revoked_at` (M2M — ver [security.md](./security.md)).
- **audit_log** — `id`, `tenant_id`, `actor_id`, `action`, `resource`, `metadata (jsonb)`, `created_at`. **Append-only / imutável** (sem UPDATE/DELETE).
- **outbox** — `id`, `aggregate`, `event_type`, `payload (jsonb)`, `occurred_at`, `published_at`. Escrita na mesma transação do agregado (ver ADR-0006). 🟡 *Tabela criada, mas ainda sem producer/relay — nenhum evento é gravado hoje.*

### Fleet
- **vehicles** — `id`, `tenant_id`, `plate`, `capacity`, `type`, `status`.
- **drivers** — `id`, `tenant_id`, `name`, `skills`, `status`.
- **depots** — `id`, `tenant_id`, `name`, `location geography(Point,4326)`. ⬜ *Planejado — tabela ainda não criada.*

### Delivery
- **deliveries** — `id`, `tenant_id`, `address`, `location geography(Point,4326)`, `time_window_start`, `time_window_end`, `priority`, `demand`, `status`.

### Routing / Optimization
- **route_plans** — `id`, `tenant_id`, `status`, `created_by`, `metrics (jsonb)`, timestamps. ✅ *Existe; as paradas otimizadas são persistidas no próprio plano (JSONB), não em tabelas separadas.*
- **routes** — `id`, `route_plan_id`, `vehicle_id`, `driver_id`, `total_distance`, `total_duration`. ⬜ *Planejado — tabela ainda não criada.*
- **route_stops** — `id`, `route_id`, `delivery_id`, `sequence`, `eta`, `status`. ⬜ *Planejado — tabela ainda não criada.*

### Realtime Tracking
- **driver_positions** — `tenant_id`, `driver_id`, `location`, `recorded_at`. 🟡 *Existe como tabela Postgres comum (RLS + índices), preparada para virar **hypertable TimescaleDB** com compressão/downsampling (ADR-0009) — a extensão ainda não foi habilitada.* Não é fonte de verdade transacional. *(O nome histórico `vehicle_positions` foi implementado como `driver_positions`.)*

### Read models (CQRS — ADR-0011)
- ⬜ *Planejado.* Tabelas de leitura desnormalizadas (ex.: `tenant_efficiency_daily`) alimentadas por eventos do outbox e servidas por **réplicas de leitura**, para dashboards/KPIs sem impactar o OLTP. *Nenhuma existe hoje; os dashboards consultam o OLTP diretamente.*

### Intelligence
- ⬜ *Planejado (Fase 3).* **prediction_features** / **model_versions** — armazenamento de features e metadados de modelos por tenant.

### Billing
- ⬜ *Planejado (Fase 4).* **subscriptions**, **usage_records**, **invoices** — planos, uso e faturamento.

## 5. Índices e performance

- Índices **GiST** nas colunas `geography`/`geometry` (PostGIS) para consultas espaciais.
- Índices compostos iniciados por `tenant_id` nas tabelas mais consultadas.
- **Particionamento** por tempo (e/ou por tenant) para tabelas de alto volume; posições via hypertables TimescaleDB.
- Consultas analíticas pesadas isoladas do OLTP via **réplicas de leitura** + **read models** (CQRS — ADR-0011).
- **PgBouncer** (transaction pooling) para suportar milhares de tenants sem esgotar conexões; mitiga *noisy neighbor*.
- Cache da **matriz de distância/tempo** no Redis com chave por **geohash** dos pontos (reduz custo/latência de provedores externos).

## 6. Redis — usos

> **Status:** 🟡 **Parcial.** Existe uma conexão Redis compartilhada e resiliente (`shared/redis`), **já usada no rate limiting** (com fallback para memória — ADR-0014). As abstrações de **cache** (`CachePort`) e **fila** (`QueuePort`) estão registradas mas **ainda não consumidas**. Os demais usos abaixo (matriz de distância, sessões/blacklist, locks) seguem como alvo.

| Uso | Detalhe |
|-----|---------|
| Cache | Matriz de distância/tempo, geocodificação, respostas idempotentes |
| Filas | Otimização, reotimização, ML, notificações (BullMQ) |
| Sessões | Blacklist/rotação de refresh tokens, controle de sessão |
| Rate limiting | Proteção de API por tenant/usuário (ver [security.md](./security.md)) |
| Locks | Locks distribuídos para reotimização concorrente |

**Regra:** Redis é volátil — nunca é fonte de verdade. Toda chave tem TTL definido.

## 7. Migrações

- Toda mudança de schema é uma **migração versionada** no controle de versão.
- Migrações são **idempotentes** e reversíveis quando possível.
- Nada de alteração manual em produção — apenas via pipeline.
- Mudança de schema exige atualização deste documento no mesmo PR.

## 8. Backup, retenção e recuperação

- Backups automáticos com teste periódico de restauração.
- Política de retenção por tipo de dado (definir conforme LGPD/GDPR).
- **RPO/RTO** a definir por ambiente (registrar em ADR).
- Point-in-time recovery habilitado em produção.

## 9. Segurança de dados

- Conexões via TLS.
- Credenciais em secret manager, com rotação.
- ⬜ *Planejado (ADR-0010, ainda não implementado):* criptografia em repouso a nível de coluna para PII/sensível com **AES-256-GCM** e **DEK por tenant** (envelope encryption). Permite *crypto-shredding* por tenant. **Hoje a PII está em texto puro.**
- Princípio do menor privilégio para usuários de banco (app ≠ migração ≠ leitura).
- Ver [security.md](./security.md) para detalhes.

## 10. Decisões em aberto (registrar ADR)

- Estratégia de sharding do OLTP para os maiores tenants (gatilho: volume).
- Data warehouse/analytics dedicado para Intelligence (Fase 3).
- Estratégia multi-região e residência de dados (schema/DB por tenant).
- Retenção/downsampling fino da telemetria por plano.

> Decididas por ADR (decisão ≠ implementação): ORM = TypeORM (ADR-0005, ✅); posições em TimescaleDB (ADR-0009, 🟡 tabela sem a extensão); analytics via read models/CQRS (ADR-0011, ⬜ não implementado).

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial |
| 2026-07-05 | 0.2 | CTO | UUIDv7, TimescaleDB, outbox/audit/api_keys, read models, PgBouncer, cache de matriz, envelope encryption |
| 2026-07-12 | 0.3 | Arquitetura | Callout de estado da implementação; marcação do que existe vs. planejado (tabelas, TimescaleDB, Redis, cripto de coluna) |
