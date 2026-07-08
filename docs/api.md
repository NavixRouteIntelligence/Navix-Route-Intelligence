# API — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.2 · **Atualizado:** 2026-07-05

Convenções e contrato da API. Toda mudança de contrato deve atualizar este documento no mesmo PR.

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

- `Authorization: Bearer <access_token>` em endpoints protegidos.
- Fluxo de refresh: `POST /api/v1/auth/refresh` com o refresh token.
- Detalhes de tokens em [security.md](./security.md).

- Integrações máquina-a-máquina usam **API key** (`X-Api-Key`) ou OAuth2 client credentials, com escopo mínimo (ver [security.md](./security.md)).

## 5.1 Operações assíncronas (jobs)

Operações pesadas (otimização de rotas, importação em massa) **não** são síncronas. O servidor responde **`202 Accepted`** com um recurso de **job**; o cliente acompanha por *polling* ou webhook.

```
POST /api/v1/route-plans/{id}:optimize      -> 202 { "data": { "jobId": "...", "status": "queued" } }
GET  /api/v1/jobs/{jobId}                    -> 200 { "status": "queued|running|succeeded|failed", "result": { } }
```

- Aceita `Idempotency-Key` para evitar duplicidade.
- Falhas retornam `status: failed` com erro padronizado (ver §7).

## 5.2 Importação em massa

Operadores logísticos importam grandes volumes de entregas. Endpoint assíncrono com validação por linha:

```
POST /api/v1/deliveries:bulk   (CSV ou JSON)  -> 202 { "jobId": "..." }
GET  /api/v1/jobs/{jobId}                      -> relatório: aceitas, rejeitadas, erros por linha
```

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

## 9. Validação e limites

- Todos os corpos validados por DTO (ver [security.md](./security.md)).
- Limite de tamanho de payload.
- Rejeição de campos desconhecidos.

## 10. Idempotência

- Operações sensíveis a duplicidade aceitam header `Idempotency-Key`.
- A resposta é cacheada por chave (Redis) por uma janela definida.

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
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

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
POST   /api/v1/route-plans          # otimiza e persiste um Route Plan (201)
GET    /api/v1/route-plans          # histórico (paginado)
GET    /api/v1/route-plans/{id}     # consulta um Route Plan
```

Corpo do POST: `origin?` (depósito), **uma** das fontes `deliveryIds[]` (busca no Delivery) **ou** `stops[]` (inline: id, lat, lng, priority?, timeWindow?), `strategy?`, `averageSpeedKmh?`, `serviceTimeMinutes?`.

Resposta (Route Plan): `stops` (ordem ideal), `metrics` (distância/tempo/nº paradas), `baseline`, `savings` (km, min, %), `score` (0–100), `explanation`, `params`, `createdAt`. Algoritmo MVP: **Nearest Neighbor + 2-opt** com distância Haversine (Strategy Pattern — extensível para OR-Tools/IA sem alterar a API).

### 14.4 Import Center — implementado (Fase 2)

Autenticado; exige `admin`/`dispatcher`. Escopado ao tenant. Ingestão de entregas a partir de arquivos, em duas etapas (pré-visualização → confirmação).

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

## 15. Documentação viva

- OpenAPI/Swagger exposto em ambiente não-produtivo.
- SDKs/clients podem ser gerados a partir do contrato.

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
