# API — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.10 · **Atualizado:** 2026-07-12

Convenções e contrato da API. Toda mudança de contrato deve atualizar este documento no mesmo PR.

> **⚠️ Estado da implementação.** A maioria dos endpoints abaixo já existe (auth, fleet, deliveries, imports, route-plans, tracking, pod, settings). **Exceções importantes:** as **operações assíncronas com `202` + recurso de job** (§5.1, §5.2) e o endpoint `GET /jobs/{jobId}` **não existem** — otimização e importação são hoje **síncronas** (respondem `201`/`200` com o resultado). A **autenticação M2M por API key** (§5) também é roadmap. Itens não implementados estão marcados com ⬜.

## 1. Princípios

- **REST** sobre HTTPS, orientado a recursos.
- **JSON** como formato padrão de request/response.
- **Consistência** de nomenclatura, erros e paginação em todos os endpoints.
- **Contrato-first**: especificação **OpenAPI 3** gerada e mantida (via NestJS Swagger).
- **Multi-tenant**: o tenant vem do JWT, nunca da URL (ver [security.md](./security.md)).

## 2. Versionamento

- Versão no caminho: `/api/v1/...`.
- Mudanças incompatíveis → nova versão maior.
- Depreciação anunciada com prazo e header `Deprecation`.

## 3. Convenções de URL

- Recursos no **plural**, `kebab-case`: `/api/v1/route-plans`.
- Hierarquia por aninhamento raso: `/api/v1/route-plans/{id}/routes`.
- Sem verbos em URLs; a ação é o método HTTP. Exceção: operações especiais como `/route-plans/{id}:optimize` (ações de domínio).

## 4. Métodos e semântica

| Método | Uso | Idempotente |
|--------|-----|-------------|
| GET | Ler recurso/coleção | Sim |
| POST | Criar / ações | Não |
| PUT | Substituir recurso | Sim |
| PATCH | Atualização parcial | Não |
| DELETE | Remover | Sim |

## 5. Autenticação

- **Login sem `tenantId` (ADR-0016):** o corpo é `{ email, password, organization? }`. O tenant é resolvido automaticamente pelo **e-mail** (identidade global); `organization` (o `slug` da empresa) é opcional, para desambiguar. Vale para `login` e `forgot-password` (web e mobile).
- `Authorization: Bearer <access_token>` em endpoints protegidos.
- **Dois fluxos dedicados, sem acoplamento (ADR-0015):**
  - **Web** — `POST /api/v1/auth/{register,login,refresh,logout}`. Refresh token entregue/lido via **cookie HttpOnly**; o corpo **nunca** o expõe. `refresh`/`logout` não recebem corpo (usam o cookie).
  - **Mobile** — `POST /api/v1/auth/mobile/{register,login,refresh,logout}`. Modelo **bearer**: `login`/`register` retornam `tokens` **com `refreshToken`** no corpo; `refresh`/`logout` recebem `{ "refreshToken": "..." }` no corpo. Sem cookie e **sem header de modo** (o antigo `X-Auth-Mode` foi eliminado).
- Endpoints de conta (`/auth/me`, `change-password`, `forgot/reset-password`) são **compartilhados** (dependem do access token).
- Detalhes de tokens em [security.md](./security.md).

- ⬜ *Planejado:* integrações máquina-a-máquina usarão **API key** (`X-Api-Key`) ou OAuth2 client credentials, com escopo mínimo (ver [security.md](./security.md)). *Ainda não implementado — hoje só há o fluxo JWT.*

## 5.1 Operações assíncronas (jobs)

> **Status:** ✅ **Implementado para a otimização de rotas (ADR-0007).** O `POST /route-plans` (e `/route-plans/mine`) **enfileira** e responde **`202 Accepted` + `jobId`**; o cliente acompanha por **polling** em `GET /route-plans/jobs/:jobId` (WebSocket é o próximo passo). A fila atual é **in-process** (BullMQ/durável é roadmap). A **importação em massa** continua síncrona (ver §5.2).

```
POST /api/v1/route-plans            -> 202 { "data": { "jobId": "...", "status": "queued" } }
POST /api/v1/route-plans/mine       -> 202 { "data": { "jobId": "...", "status": "queued" } }
GET  /api/v1/route-plans/jobs/:id   -> 200 { "data": { "jobId", "status": "queued|running|succeeded|failed",
                                                        "routePlanId": "…|null", "error": "…|null" } }
GET  /api/v1/route-plans/:id        -> 200 { "data": <RoutePlan> }   # quando o job conclui (succeeded)
```

- Aceita `Idempotency-Key` (o reenvio replica o mesmo `jobId` — ver §10).
- Validação **estrutural** do corpo continua síncrona (`400` na borda); erros do solver viram `status: failed` no job.

## 5.2 Importação em massa

> **Status:** 🟡 **Parcial.** O Import Center **existe e é síncrono**: `POST /api/v1/imports/preview` (upload + validação por linha) e `POST /api/v1/imports/confirm` (cria as entregas), além do histórico em `GET /api/v1/imports`. **Não há** o `deliveries:bulk` assíncrono com `202`/job descrito abaixo — isso é roadmap.

Operadores logísticos importam grandes volumes de entregas. Endpoint assíncrono com validação por linha:

```
POST /api/v1/deliveries:bulk   (CSV ou JSON)  -> 202 { "jobId": "..." }
GET  /api/v1/jobs/{jobId}                      -> relatório: aceitas, rejeitadas, erros por linha
```

## 5.3 Tempo real (SSE — ADR-0018)

✅ **Implementado.** Transporte **servidor → cliente** por **Server-Sent Events**; o **polling** dos recursos permanece apenas como *fallback*. Contrato (vale para **Web** e **Flutter**):

```
POST /api/v1/realtime/ticket        (Bearer)  -> 200 { "ticket": "…", "expiresIn": 60 }
GET  /api/v1/realtime/stream?ticket=<ticket>  -> text/event-stream (EventSource)
```

- O `EventSource` não envia `Authorization`; por isso a conexão usa um **ticket** curto (obtido no `/ticket` autenticado e passado na query). O ticket expira em 60s e é reutilizável dentro do TTL (tolera reconexões).
- Cada mensagem SSE é um JSON no campo `data`, uma **união discriminada por `type`**:

```jsonc
{ "type": "tracking.position", "data": { /* DriverPositionView */ } }
{ "type": "optimization.job",  "data": { /* OptimizationJob (status do job) */ } }
{ "type": "ping",              "data": { "at": "2026-07-13T…Z" } }   // keep-alive (~25s)
```

- **Escopo por tenant:** o stream só entrega eventos do tenant do ticket.
- **Fluxo de consumo:** obter ticket → abrir `EventSource` → tratar `onmessage` por `type` → em `onerror`, **fechar, obter novo ticket e reconectar com backoff** (o web já faz isso no `RealtimeProvider`).
- **Flutter:** consumir `GET /realtime/stream?ticket=…` como stream HTTP (`http`/`dio` com resposta em streaming ou pacote SSE), aplicando o mesmo fluxo de ticket + reconexão.
- **Escala:** o hub é *in-process* (single-instance); multi-réplica exige Redis pub/sub (roadmap) — até lá, o *fallback* de polling cobre.

## 6. Formato de resposta

Sucesso — recurso único:
```json
{
  "data": { "id": "uuid", "type": "route-plan", "attributes": { } }
}
```

Sucesso — coleção paginada:
```json
{
  "data": [ ],
  "meta": { "page": 1, "pageSize": 20, "total": 135 },
  "links": { "next": "/api/v1/deliveries?page=2", "prev": null }
}
```

## 7. Erros

Formato padronizado (nunca vaza detalhes internos):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição legível e segura.",
    "details": [ { "field": "email", "issue": "invalid" } ],
    "requestId": "uuid"
  }
}
```

| HTTP | Código | Quando |
|------|--------|--------|
| 400 | VALIDATION_ERROR | Entrada inválida |
| 401 | UNAUTHENTICATED | Sem/inválido token |
| 403 | FORBIDDEN | Sem permissão / outro tenant |
| 404 | NOT_FOUND | Recurso inexistente no tenant |
| 409 | CONFLICT | Conflito de estado/duplicidade |
| 422 | UNPROCESSABLE | Semântica inválida |
| 429 | RATE_LIMITED | Limite excedido |
| 500 | INTERNAL | Erro inesperado (sem detalhes) |

- `requestId` correlaciona com logs para suporte.
- 4xx = culpa do cliente; 5xx = culpa do servidor. Não usar 200 para erro.

## 8. Paginação, filtro e ordenação

- Paginação por página: `?page=1&pageSize=20` (`pageSize` máximo definido e validado).
- Alternativa cursor para alto volume: `?cursor=...&limit=...`.
- Filtro: `?status=planned&priority=high`.
- Ordenação: `?sort=-created_at,priority` (`-` = desc).

## 8.1 Sincronização incremental (offline-first — ADR-0020)

> **Status:** ✅ **Implementado para entregas** (`GET /api/v1/deliveries/sync`). Base genérica reutilizável (contratos `SyncParams`/`SyncResponse<T>` + cursor de keyset) preparada para outros recursos (fleet, pod) adotarem.

Clientes offline (Flutter, PWA) **não devem re-baixar a coleção inteira** a cada abertura. O feed de sincronização entrega **apenas o que mudou** desde a última sincronização, incluindo **exclusões** (tombstones), com **paginação por cursor de keyset** (estável e barata mesmo em grandes volumes).

```
GET /api/v1/deliveries/sync?updatedSince=<ISO>&cursor=<opaco>&limit=<1..500>
-> 200 {
     "data": [ <Delivery com deletedAt: string|null> ],
     "meta": { "syncedAt": "<ISO>", "nextCursor": "<opaco>|null", "hasMore": true|false, "limit": 100 }
   }
```

- **Rodada de sync:** a **primeira** página usa `updatedSince` (a marca d'água que o cliente guardou do `syncedAt` anterior); as **páginas seguintes** usam o `nextCursor` opaco (tem precedência sobre `updatedSince`). Sem nenhum dos dois, é um **sync completo inicial** (tudo, paginado).
- **Tombstones:** entregas excluídas (soft delete) voltam com `deletedAt != null` — o cache local as **remove**. Em leituras normais (`list`/`get`) `deletedAt` é sempre `null`.
- **Ordenação canônica:** `(updated_at ASC, id ASC)` — keyset, não offset. Índice dedicado `idx_deliveries_tenant_sync` (inclui tombstones).
- **Marca d'água:** o cliente persiste `meta.syncedAt` e o envia como `updatedSince` na próxima rodada. O limite `>=` tolera sobreposição mínima; os *upserts* do cliente devem ser **idempotentes** por `id` (combina com o `Idempotency-Key` do §10 no caminho de escrita).
- **Cursor** é **opaco** (base64url de `(updatedAt, id)`); cursor malformado → `400`.
- **Fluxo Flutter/PWA:** `updatedSince = last syncedAt` → seguir `nextCursor` até `hasMore=false` → aplicar upserts/deletes por `id` → salvar o novo `syncedAt`.

## 9. Validação e limites

- Todos os corpos validados por DTO (ver [security.md](./security.md)).
- Limite de tamanho de payload.
- Rejeição de campos desconhecidos.

## 10. Idempotência

✅ **Implementado (ADR-0017).** Operações **críticas** aceitam o header `Idempotency-Key` (opcional). O reenvio com a mesma chave **replica** a resposta da primeira execução (mesmo status e corpo, com o header `Idempotency-Replayed: true`), sem duplicar o efeito — essencial para re-sincronização offline.

- **Aplicado em:** `POST /pod`, `POST /tracking/positions`, `POST /imports/:id/confirm`, `POST /route-plans` e `POST /route-plans/mine`.
- **Escopo da chave:** `(tenant, Idempotency-Key, método, rota)`. A gravação é **atômica** com a operação (mesma transação de tenant). Chave entre 8 e 200 caracteres.
- **Sem o header**, o comportamento é o normal (idempotência é opt-in por request).
- Armazenamento em `idempotency_keys` (Postgres, escopado por RLS). Um TTL/limpeza das chaves é roadmap.

## 11. Datas, unidades e i18n

- Datas em **ISO 8601 UTC** (`2026-07-05T12:00:00Z`).
- Coordenadas em WGS84 (lat/lng).
- Unidades e moeda explícitas nos payloads na fase de escala global.
- Idioma via header `Accept-Language`.

## 12. Rate limiting e quotas

- Limites por tenant/usuário retornam headers `RateLimit-*` e `429` ao exceder.
- **Quotas por plano** (ex.: otimizações/dia, tamanho de bulk import) — endpoints caros são enfileirados por tenant para isolamento (ver [security.md](./security.md)).

## 13. Webhooks / eventos (Fase 2+)

- Eventos como `route.planned`, `route.reoptimized`, `delivery.completed`.
- Payload assinado (HMAC) para verificação de origem.
- Retentativas com backoff e *dead-letter*.

## 14. Exemplos de endpoints (preliminar)

```
# Web (cookie HttpOnly)
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
# Mobile (bearer token no corpo) — ADR-0015
POST   /api/v1/auth/mobile/register
POST   /api/v1/auth/mobile/login
POST   /api/v1/auth/mobile/refresh
POST   /api/v1/auth/mobile/logout
# Conta (compartilhado, via access token)
GET    /api/v1/auth/me

GET    /api/v1/deliveries
POST   /api/v1/deliveries
GET    /api/v1/deliveries/{id}
PATCH  /api/v1/deliveries/{id}

POST   /api/v1/route-plans
POST   /api/v1/route-plans/{id}:optimize
GET    /api/v1/route-plans/{id}
GET    /api/v1/route-plans/{id}/routes

POST   /api/v1/deliveries:bulk
GET    /api/v1/jobs/{jobId}

GET    /api/v1/vehicles
GET    /api/v1/drivers
```

### 14.0 Contas e perfis (RBAC) — implementado

`POST /api/v1/auth/register` (público, rate-limited) cria a conta com escolha de perfil e já autentica (retorna `user` + `tokens` + `accountType`):

```
POST /api/v1/auth/register
  body: { accountType: 'driver' | 'company', name, email, password, organizationName? }
  201:  { user, tokens, accountType }
```

- **`company`** (Empresa): cria a organização e o usuário como `admin` → Dashboard administrativo.
- **`driver`** (Motorista Autônomo): cria uma **organização pessoal** (tenant `account_type='driver'`) e o usuário como `driver` (motorista principal) → Dashboard do Motorista. O veículo é cadastrado depois (onboarding).

Tenant + usuário são criados numa única transação. O **RBAC** usa `roles[]` no JWT: a interface (web) é adaptada automaticamente pelo papel (nav, rotas e dashboards). Papéis: `admin`/`dispatcher`/`fleet_manager` (empresa) e `driver` (autônomo).

**Multi-tenant preservado.** Como o motorista autônomo é um tenant com `account_type='driver'` e usuário no mesmo tenant, a futura **migração Autônomo → Empresa** é feita alterando `account_type` + papéis, **sem perda de dados, histórico ou configurações** (sem endpoint nesta fase).

### 14.1 Fleet — implementado (Fase 1)

Todas as rotas exigem `Authorization: Bearer <access_token>`. Mutações exigem papel `admin` ou `fleet_manager`. Escopadas ao tenant do token.

```
# Veículos
POST   /api/v1/fleet/vehicles            # cria (201)
GET    /api/v1/fleet/vehicles            # lista paginada (?page&pageSize)
GET    /api/v1/fleet/vehicles/{id}       # detalhe
PATCH  /api/v1/fleet/vehicles/{id}       # atualiza parcial
DELETE /api/v1/fleet/vehicles/{id}       # remove (204)

# Motoristas
POST   /api/v1/fleet/drivers             # cria (201)
GET    /api/v1/fleet/drivers             # lista paginada
GET    /api/v1/fleet/drivers/{id}        # detalhe
PATCH  /api/v1/fleet/drivers/{id}        # atualiza parcial
DELETE /api/v1/fleet/drivers/{id}        # remove (204)
```

Corpo de criação de veículo: `{ plate, type, capacity, status? }` — `type ∈ {car,van,truck,motorcycle,bicycle}`, `status ∈ {active,inactive,maintenance}`.
Corpo de criação de motorista: `{ name, licenseNumber, skills?, status? }` — `status ∈ {active,inactive}`.

### 14.2 Delivery — implementado (Fase 1)

Autenticado; mutações exigem `admin` ou `dispatcher`. Escopado ao tenant.

```
POST   /api/v1/deliveries                # cadastra (201)
GET    /api/v1/deliveries                # lista: filtros + ordenação + paginação
GET    /api/v1/deliveries/{id}           # consulta por ID
PATCH  /api/v1/deliveries/{id}           # atualiza dados
PATCH  /api/v1/deliveries/{id}/status    # altera status (máquina de estados)
DELETE /api/v1/deliveries/{id}           # exclusão lógica (204)
```

Filtros da listagem: `status`, `priority`, `driverId`, `vehicleId`, `routeId`, `windowFrom`, `windowTo`. Ordenação: `sort=-createdAt,priority` (campos: `createdAt`, `windowStart`, `priority`). Paginação: `page`, `pageSize`.

Status: `pending → in_route → {delivered|failed}`; `failed → in_route`; `pending/in_route/failed → canceled`. `delivered` e `canceled` são terminais. `priority ∈ {low,normal,high,urgent}`.

**Swagger/OpenAPI:** disponível em `GET /api/docs` fora de produção.

### 14.3 Route Optimizer — implementado (Fase 1)

Autenticado; otimização exige `admin`/`dispatcher`. Escopado ao tenant.

```
POST   /api/v1/route-plans          # otimiza e persiste um Route Plan (201) — admin/dispatcher
POST   /api/v1/route-plans/mine      # Motorista Autônomo otimiza a própria rota (201) — role driver
GET    /api/v1/route-plans          # histórico (paginado)
GET    /api/v1/route-plans/{id}     # consulta um Route Plan
```

Corpo do POST: `origin?` (depósito), **uma** das fontes `deliveryIds[]` (busca no Delivery) **ou** `stops[]` (inline: id, lat, lng, priority?, timeWindow?), `strategy?`, `averageSpeedKmh?`, `serviceTimeMinutes?`.

`/route-plans/mine` é **aditivo** (não altera o fluxo de Empresa): usa o **mesmo motor** com o papel `driver`, escopado ao tenant do motorista pela RLS. O painel de rentabilidade (lucro, custos de combustível/energia e portagens, ganho líquido) é calculado no cliente a partir das métricas do plano + parâmetros configuráveis. Fatores de **trânsito em tempo real, acidentes e estradas fechadas** ficam como integração futura (arquitetura de estratégias/distância pronta para recebê-los).

Resposta (Route Plan): `stops` (ordem ideal), `metrics` (distância/tempo/nº paradas), `baseline`, `savings` (km, min, %), `score` (0–100), `explanation`, `params`, `createdAt`. Algoritmo MVP: **Nearest Neighbor + 2-opt** com distância Haversine (Strategy Pattern — extensível para OR-Tools/IA sem alterar a API).

### 14.4 Import Center — implementado (Fase 2)

Autenticado; `preview`/`confirm` exigem `admin`/`dispatcher`/**`driver`** (o Motorista Autônomo importa para a própria conta); consultas e catálogo abertos a qualquer autenticado. Escopado ao tenant (RLS). Ingestão de entregas a partir de arquivos, em duas etapas (pré-visualização → confirmação). As entregas confirmadas alimentam o Delivery, o Route Optimizer e o dashboard do motorista. **Fleet e gestão de usuários seguem exclusivos da conta Empresa.**

```
GET    /api/v1/imports/connectors   # catálogo de conectores (disponíveis e planejados)
POST   /api/v1/imports/preview      # upload multipart (campo "file") → lote em preview (201)
POST   /api/v1/imports/{id}/confirm # cria entregas e (opcional) otimiza a rota
GET    /api/v1/imports              # histórico (paginado)
GET    /api/v1/imports/{id}         # detalhe: linhas processadas + erros
```

- **Conectores**: a ingestão é plugável por conectores (famílias `file`, `capture`, `integration`). Hoje `available`: CSV, Excel, PDF. `planned` (estrutura pronta, sem lógica): Barcode, QR Code, OCR, E-mail, API, Webhooks, ERP. Ver [modules/import-center.md](./modules/import-center.md) §7.

- **Upload**: `multipart/form-data`, campo `file`. Formatos: **CSV**, **XLS/XLSX**, **PDF**. Limite 5 MB; até 1000 linhas por arquivo. O tipo é detectado pela extensão.
- **Detecção de colunas**: mapeamento automático por sinônimos (pt/en) para Destinatário, Endereço, Telefone, Nº da encomenda, Observações e Prioridade; aceita `latitude`/`longitude` quando presentes.
- **Processamento por linha**: geocodificação (Mapbox, server-side) quando faltam coordenadas; classificação do endereço (Residência, Comércio, Condomínio, Empresa, Indefinido); validação de obrigatórios; detecção de duplicados (por nº da encomenda ou por endereço+coordenadas).
- **Resposta do preview**: `batch` (com `summary`: total, válidas, inválidas, duplicados, economia estimada em km/%) e `rows[]` (status `valid|invalid|duplicate`, categoria, flags `geocoded`/`lowConfidence`, `errors[]`).
- **Confirmação** (`{ optimize?: boolean }`): cria as entregas válidas no módulo Delivery e, se `optimize=true` e houver ≥ 2 entregas, dispara o Route Optimizer; retorna `createdDeliveries` e `routePlanId`.
- **PDF**: extração best-effort — linhas marcadas com `lowConfidence`.
- **Segurança/isolamento**: RLS por tenant na tabela `import_batches`; auditoria em `import.previewed` e `import.confirmed`.
- **Extensibilidade**: parsers registrados como multi-provider (Strategy). Novas fontes (Shopee, Amazon, Shopify, WooCommerce, APIs externas, OCR) entram adicionando um parser/adaptador, sem alterar o contrato.

### 14.5 Tracking — implementado (MVP)

Rastreamento de posição de motoristas. Isolado por tenant (RLS) e com RBAC. Estados: `offline` (derivado por inatividade), `en_route`, `finished`.

```
POST /api/v1/tracking/positions          # motorista envia sua posição (role driver)
POST /api/v1/tracking/positions/batch    # motorista envia VÁRIAS posições (sync offline)
GET  /api/v1/tracking/me/latest          # última posição do próprio motorista
GET  /api/v1/tracking/me/history         # histórico do próprio motorista
GET  /api/v1/tracking/positions/latest   # frota: última posição de cada motorista (empresa)
GET  /api/v1/tracking/drivers/{id}/history  # histórico de um motorista (empresa)
```

- **Payload de posição**: `{ latitude, longitude, recordedAt?, speed?, heading?, status? }`. `status` reportável: `en_route` | `finished`; `offline` é calculado pelo servidor quando não há atualização recente.
- **Envio em lote** (`positions/batch`): corpo `{ positions: [ …payload… ] }` (1 a 500), resposta `{ accepted, positions }` (`201`). Um único INSERT + publicação em tempo real de cada ponto; ideal para o dispositivo **reenviar a fila offline** numa requisição só. Aceita `Idempotency-Key`. O endpoint **unitário** permanece por compatibilidade.
- **Perfis**: os endpoints `me/*` servem tanto o Motorista Autônomo quanto o motorista de empresa (veem só a si). A **visão de frota** (`positions/latest`, `drivers/:id/history`) é hoje restrita a `admin`/`dispatcher`/`fleet_manager` (empresa) — o ponto único para liberá-la ao Autônomo no futuro é o `@Roles` desses dois endpoints.
- **Persistência**: tabela `driver_positions` (append-only) com RLS FORCE por tenant, **preparada para virar hypertable do TimescaleDB** (fase de telemetria).
- **Tempo real**: cada posição (unitária ou em lote) é publicada por **SSE** (`optimization.job`/`tracking.position` — §5.3); o frontend consome em tempo real e faz *polling* só como fallback (ADR-0018).
- **Extensível** para ETA, otimização dinâmica e notificações.

### 14.6 Proof of Delivery (POD) — implementado

Comprovante de entrega registrado pelo motorista. Isolado por tenant (RLS) e com RBAC.

```
POST /api/v1/pod                  # registra o comprovante (role driver/admin/dispatcher)
GET  /api/v1/pod                  # histórico (paginado)
GET  /api/v1/pod/summary          # resumo por status (Dashboard)
GET  /api/v1/pod/{deliveryId}     # comprovante de uma entrega
```

- **Payload**: `{ deliveryId, status, note?, latitude?, longitude?, photo?, signature? }`. `status`: `delivered` | `absent` | `refused`. O cliente envia `photo`/`signature` como **data URLs** (foto reduzida no cliente; assinatura em canvas); o backend faz o **offload para object storage** e o campo aceita passar direto uma **URL** já hospedada (upload direto futuro). Comprovante `delivered` exige foto **ou** assinatura.
- **Integração com Delivery**: ao registrar, o POD aplica o desfecho na entrega na **mesma transação** — `delivered`→`delivered`, `absent`/`refused`→`failed` — respeitando a máquina de estados (passa por `in_route`). Um comprovante por entrega (índice único).
- **Integração com Tracking**: o cliente também registra a posição do desfecho (`finished`).
- **Dashboard**: card de resumo (entregues/ausentes/recusados) + últimos comprovantes; nas **Entregas**, ícone para visualizar foto/assinatura/GPS/observação.
- **Persistência**: `proof_of_delivery` (RLS FORCE por tenant). Mídia **fora do Postgres**: enviada a um **object storage** (`StorageService` — driver `local` em dev, `s3`/R2/GCS em produção) e o banco guarda **apenas a URL** em `photo`/`signature` (ADR-0019). O cliente ainda envia data URL por compatibilidade; limite de body de 8 MB para as mídias.
- **Web e Mobile**: componentes responsivos, câmera via `capture` e assinatura por toque (PWA). App nativo fora do escopo desta fase.

## 15. Documentação viva

- OpenAPI/Swagger exposto em ambiente não-produtivo.
- SDKs/clients podem ser gerados a partir do contrato.

## 16. Observabilidade (ADR-0021)

Endpoints operacionais (não versionados, públicos — restringir por rede em produção). Detalhes em [observability.md](./observability.md).

```
GET /metrics                 -> text/plain (Prometheus): métricas de processo + HTTP (RED)
GET /api/v1/health/live      -> 200 { "status": "ok" }              # liveness
GET /api/v1/health/ready     -> 200 | 503 (Postgres duro; Redis reportado, não fatal)  # readiness
```

- Cada resposta traz `x-request-id` (correlaciona com os logs; ecoa o header de entrada se houver).
- Com `OTEL_ENABLED=true`, as requisições geram **traces** OpenTelemetry (propaga `traceparent`) e os logs carregam `trace_id`/`span_id`.

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial |
| 2026-07-05 | 0.2 | CTO | Jobs assíncronos (202), bulk import, API keys M2M, quotas por plano |
| 2026-07-05 | 0.3 | Engenharia | Fase 1: endpoints do Fleet (vehicles, drivers) implementados |
| 2026-07-07 | 0.4 | Engenharia | Fase 2: Import Center (preview/confirm/histórico) implementado |
| 2026-07-08 | 0.5 | Engenharia | Import Center: arquitetura de conectores plugáveis + GET /imports/connectors |
| 2026-07-08 | 0.6 | Engenharia | Contas por perfil (RBAC): POST /auth/register (Motorista Autônomo × Empresa), tenant.account_type, Dashboard do Motorista |
| 2026-07-08 | 0.7 | Engenharia | Tracking (MVP): posições do motorista, visão de frota (empresa), driver_positions (TimescaleDB-ready), mapa em tempo real |
| 2026-07-08 | 0.8 | Engenharia | Otimização IA para Motorista Autônomo: POST /route-plans/mine (aditivo), painel de rentabilidade, integração com tracking |
| 2026-07-09 | 0.9 | Engenharia | Proof of Delivery: comprovante (foto/assinatura/GPS/status), integração Delivery+Tracking+Dashboard |
| 2026-07-12 | 0.10 | Arquitetura | Alinhamento doc↔código: marcado que jobs assíncronos (202, §5.1/§5.2) e M2M por API key **não** existem; otimização/importação são síncronas |
| 2026-07-13 | 0.11 | Arquitetura | Auth Web (cookie) × Mobile (bearer) por endpoints dedicados `/auth/mobile/*` (ADR-0015); header X-Auth-Mode removido |
| 2026-07-13 | 0.12 | Arquitetura | Login sem tenantId: `{ email, password, organization? }` — tenant por e-mail/slug (ADR-0016) |
| 2026-07-13 | 0.13 | Arquitetura | Idempotency-Key implementado em POD, tracking, import/confirm e otimização (ADR-0017) |
| 2026-07-13 | 0.14 | Arquitetura | Otimização assíncrona: POST /route-plans → 202 + jobId; GET /route-plans/jobs/:id (ADR-0007) |
| 2026-07-13 | 0.15 | Arquitetura | Tempo real por SSE: /realtime/ticket + /realtime/stream; eventos tracking.position e optimization.job (ADR-0018) |
| 2026-07-13 | 0.16 | Arquitetura | Tracking em lote: POST /tracking/positions/batch (1–500) para sincronização offline; unitário mantido |
| 2026-07-13 | 0.17 | Arquitetura | POD: mídia em object storage (StorageService, driver local/s3); banco guarda só a URL; data URL aceita por compatibilidade (ADR-0019) |
| 2026-07-14 | 0.18 | Arquitetura | Sincronização incremental offline-first: GET /deliveries/sync (updatedSince + cursor de keyset, tombstones via deletedAt) — §8.1, ADR-0020 |
| 2026-07-14 | 0.19 | Arquitetura | Observabilidade: GET /metrics (Prometheus), /health/{live,ready} com Redis não-fatal, tracing OTel opt-in (§16, ADR-0021) |
