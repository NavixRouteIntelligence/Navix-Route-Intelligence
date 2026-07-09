# Navix Mobile (Flutter) — Arquitetura (Aprovada)

> **Status:** Aprovada · **Autor:** Arquitetura/Tech Lead Mobile · **Data:** 2026-07-09
> Decisões confirmadas (§12). Sem código ainda — próximos passos em §14, aguardando "go" para implementar.

## 0. Contexto e escopo

O backend é uma API REST (`/api/v1`) NestJS, **multi-tenant** (tenant no JWT, RLS no Postgres), com **JWT RS256** (access) + **refresh token opaco rotativo**, RBAC por papéis (`driver`, `admin`, `dispatcher`, `fleet_manager`) e os módulos: Auth/Perfis, Delivery, Route Optimizer, Tracking, Import Center e Proof of Delivery.

**O app mobile atende dois perfis** (RBAC), com experiências distintas na mesma base:
- **Motorista** (Autônomo e de empresa): ver/otimizar a rota, navegar, compartilhar localização (tracking), registrar comprovantes (POD) — **offline-first** em campo.
- **Empresa** (`admin`/`dispatcher`/`fleet_manager`): dashboard operacional, entregas, importação, rastreamento da frota e visualização de comprovantes — em versão mobile enxuta (o Web segue como painel completo).

A interface é **adaptada por papel** (guards + casca de navegação por perfil), exatamente como no Web.

**Princípios norteadores:** Clean Architecture + DDD (espelhando o backend), **Offline-First**, testabilidade, segurança por padrão, e paridade de contrato com a API (gerar cliente a partir do OpenAPI/Swagger que a API já expõe).

---

## 1. Estrutura de pastas (feature-first + Clean Architecture)

Organização **por feature**, cada uma com 3 camadas (`data` / `domain` / `presentation`). Núcleo transversal em `core/`.

```
lib/
├─ main_dev.dart / main_staging.dart / main_prod.dart   # entrypoints por flavor
├─ app/
│  ├─ app.dart                # MaterialApp.router, tema, localização
│  ├─ router/                 # go_router, rotas tipadas, guards
│  ├─ di/                     # bootstrap do get_it/injectable
│  └─ theme/                  # design tokens Navix (light/dark)
├─ core/
│  ├─ config/                 # env, flavors, constantes, feature flags
│  ├─ network/                # Dio, interceptors, ApiResult, mapeamento de erro
│  ├─ error/                  # Failure/Exception (freezed)
│  ├─ storage/                # secure storage, banco local, key-value
│  ├─ sync/                   # SyncEngine, Outbox, Connectivity
│  ├─ location/               # serviço de GPS/background
│  ├─ security/               # pinning, biometria, integridade
│  ├─ l10n/                   # traduções (pt-BR, pt-PT, en, es)
│  └─ ui/                     # design system compartilhado (widgets, estados)
└─ features/
   ├─ auth/                   # login, registro (perfil), refresh, sessão
   ├─ deliveries/             # lista/detalhe de entregas (cache offline)
   ├─ route/                  # otimização (route-plans/mine) + navegação (deep link)
   ├─ tracking/               # motorista: compartilha posição · empresa: mapa da frota
   ├─ pod/                    # Proof of Delivery (foto, assinatura, GPS)
   ├─ dashboard/              # empresa: KPIs, AI Insights, resumo POD
   ├─ imports/                # empresa/motorista: importar entregas (CSV/XLSX/PDF)
   └─ profile/                # conta, tema, idioma, preferências
      ├─ data/        (datasources remoto/local, models/DTO, repositories impl)
      ├─ domain/      (entities, repositories [interfaces], usecases)
      └─ presentation/ (blocs/cubits, pages, widgets)
```

> **Por perfil:** o Motorista usa `route`, `tracking`, `pod`, `imports` (próprias entregas), `profile`. A Empresa usa `dashboard`, `deliveries`, `tracking` (frota), `pod` (visualização), `imports`, `profile`. As features são compartilhadas; a **composição por papel** ocorre na navegação (§3).

**Regra de dependência:** `presentation → domain ← data`. O `domain` não depende de Flutter nem de pacotes de infra. Mapeamento DTO↔Entity fica na `data`.

---

## 2. Gerenciamento de estado — **BLoC / Cubit** (`flutter_bloc`)

- **Cubit** para telas simples (perfil, configurações); **Bloc** (eventos) para fluxos com máquina de estados (login, sincronização, POD, otimização).
- Estados imutáveis com **`freezed`** (`loading/data/error/empty`), alinhados aos estados do design system web.
- **Justificativa:** previsível, testável (`bloc_test`), separa intenção (event) de estado, ótimo para equipe e para fluxos offline com transições explícitas.
- **Alternativa considerada:** Riverpod (excelente DX). Recomendo BLoC pela consistência com DDD/Clean e testes de máquina de estados; decisão em aberto (§12).

---

## 3. Navegação — **`go_router`**

- Roteamento **declarativo** com **deep links** (abrir uma entrega/POD via notificação) e **URLs tipadas**.
- **Guards/redirect:** sessão ausente → `/login`; sessão presente em rota de auth → home do perfil; **guarda por papel** (motorista não acessa rotas de empresa e vice-versa) — igual ao Web.
- **Duas cascas por perfil** (`ShellRoute` com navegação inferior):
  - **Motorista:** Rota · Entregas/Importar · Perfil.
  - **Empresa:** Dashboard · Entregas · Rastreamento · Perfil.
- A casca é escolhida pelo papel do usuário logado; `refreshListenable` ligado ao `AuthBloc` reavalia rotas quando a sessão muda.

---

## 4. Injeção de dependências — **`get_it` + `injectable`**

- **`injectable`** (codegen) para registro com segurança em tempo de compilação.
- **Escopos:** *singletons* (Dio, storage, SyncEngine, repositórios), *factory* (blocs/cubits), *lazy singletons* para serviços caros.
- Módulos de DI por feature; **override** fácil em testes (registrar fakes).
- Bootstrap único em `app/di/`, chamado no `main_*` de cada flavor.

---

## 5. Comunicação com a API — **Dio + Retrofit** (cliente gerado)

- **`dio`** como HTTP client, com **`retrofit` + `json_serializable`** para clientes tipados por feature.
- **Contrato-first:** gerar os modelos/cliente a partir do **OpenAPI** que a API expõe (Swagger), evitando divergência com os contratos NestJS.
- **Interceptors (ordem):**
  1. **AuthInterceptor** — injeta `Authorization: Bearer` e o tenant da sessão; em `401`, faz **refresh single-flight** (uma renovação por vez, enfileirando as demais) e repete a requisição; detecção de reuso → logout forçado.
  2. **RetryInterceptor** — backoff exponencial para GET idempotente e para o flush do outbox; respeita `Retry-After`.
  3. **IdempotencyInterceptor** — envia `Idempotency-Key` nas mutações (a API já prevê), evitando duplicidade em reenvios.
  4. **ErrorInterceptor** — mapeia HTTP/erros de rede para `Failure` tipado.
  5. **LoggingInterceptor** — apenas em debug (com redaction de tokens/PII).
- **Resultado tipado:** `Either<Failure, T>` (dartz/freezed) — nada de exceção vazando para a UI.

---

## 6. Armazenamento local

| Necessidade | Tecnologia | Motivo |
|-------------|-----------|--------|
| Tokens (access/refresh), chaves | **`flutter_secure_storage`** | Keychain (iOS) / Keystore (Android) |
| Cache estruturado (entregas, rota, outbox) | **`drift`** (SQLite) + **SQLCipher** | Relacional, migrações, **queries reativas** (streams), banco **criptografado** |
| Preferências simples (tema, idioma, flags) | **`shared_preferences`** | Leve, não sensível |
| Mídia (fotos do POD, assinatura) | Arquivo em `path_provider` + referência no DB | Evita blobs grandes em memória/JSON |

- **Alternativa:** Isar (NoSQL, muito rápido). Recomendo **Drift** pela integridade relacional, migrações e streams reativos que sustentam o Offline-First. Decisão em aberto (§12).

---

## 7. Offline-First

- **Fonte única da verdade = banco local.** A UI observa o DB (streams do Drift); a rede apenas **sincroniza** para dentro do DB (*stale-while-revalidate*).
- **Leitura:** entregas/rota são cacheadas com `updatedAt`/TTL; ao abrir, mostra o cache e revalida em background.
- **Escrita:** toda mutação (registrar POD, concluir entrega, posição) é gravada primeiro no **Outbox** local (status `pending`), refletindo na UI imediatamente (*optimistic UI*).
- **Mídia offline:** foto/assinatura salvas em disco; o item do outbox referencia o arquivo.
- **Permissões e captura funcionam 100% offline**; o envio é diferido.

---

## 8. Sincronização — **SyncEngine + Outbox + Background**

- **Gatilhos:** reconexão (`connectivity_plus`), retomada do app (lifecycle), pós-ação do usuário e **periódico em background** (`workmanager` → WorkManager/BGTaskScheduler).
- **Outbox:** processa em ordem, com **idempotency key**, backoff e limite de tentativas; itens falhos vão para "revisão".
- **Posições de tracking:** enviadas em **lote**; conflito = *last-write-wins* (dado temporal).
- **POD:** criação única por entrega (índice único no backend) → em duplicidade, o servidor rejeita e o cliente **reconcilia** (marca como sincronizado).
- **Mídia:** upload resiliente; preparado para **URL pré-assinada/object storage** quando o backend evoluir (hoje base64 na API).
- **Observabilidade:** contadores de pendências/erros visíveis ao usuário ("X itens aguardando envio").

---

## 9. Segurança

- **Tokens** só em secure storage; **refresh rotativo** com single-flight e logout em reuso.
- **Certificate pinning** (Dio + fingerprint) para o host da API.
- **Banco local criptografado** (SQLCipher) — POD contém PII (foto, assinatura, GPS).
- **Bloqueio por biometria** (`local_auth`) opcional ao abrir o app.
- **Integridade do dispositivo** (root/jailbreak) opcional para operações sensíveis.
- **Ofuscação** de release (`--obfuscate --split-debug-info`); **sem segredos no código** (flavors + `--dart-define`).
- **Permissões mínimas** (câmera, localização) com justificativa; tratamento explícito de **localização em background**.
- **Multi-tenant:** o app **nunca** confia em tenant do cliente; isolamento é garantido pelo backend (RLS + token). Redaction de PII em logs/crash.

---

## 10. Estratégia de testes (pirâmide)

- **Unit** (base): use cases, mappers, `SyncEngine`, políticas de retry/idempotência — `mocktail`.
- **Bloc tests** (`bloc_test`): transições de estado de cada fluxo.
- **Repository tests:** com data source fake + **DB em memória** (Drift), cobrindo caminhos online/offline.
- **Widget tests:** telas-chave e estados (loading/empty/error/success).
- **Golden tests:** componentes do design system (light/dark).
- **Integração** (`integration_test`): fluxos críticos — login → otimizar → navegar; **POD offline → sincronização**.
- **Contrato:** validação contra o **OpenAPI** do backend (evita *API drift*) + testes de fumaça contra ambiente de staging.
- **CI:** `flutter analyze` + testes + **cobertura mínima** por camada; gates no PR.

---

## 11. Transversais (cross-cutting)

- **Flavors/ambientes:** dev / staging / prod (`--dart-define` + entrypoints).
- **Localização:** PT-BR, PT-PT, EN, ES (paridade com o web) via `flutter_localizations`/`slang`.
- **Design System:** tema e tokens da Navix (light/dark), componentes espelhando o web.
- **Observabilidade:** crash/erros (**Sentry**) com redaction; métricas de sync.
- **CI/CD:** GitHub Actions/Codemagic, *code signing*, distribuição interna (TestFlight/Firebase App Distribution).
- **Notificações push** (fase seguinte): FCM/APNs para novas entregas/rotas.

---

## 12. Decisões aprovadas

1. **Gerência de estado:** ✅ **BLoC/Cubit** (`flutter_bloc` + `freezed`).
2. **Banco local:** ✅ **Drift + SQLCipher** (SQLite relacional, reativo, criptografado).
3. **Escopo do app:** ✅ **Motorista + Empresa** (RBAC, cascas de navegação por perfil).
4. **Navegação em mapa:** ✅ **Deep link** para Google/Apple Maps com os waypoints otimizados (turn-by-turn embarcado fica para fase futura).

## 13. Stack proposta (resumo)

`flutter_bloc` · `freezed` · `get_it`+`injectable` · `go_router` · `dio`+`retrofit`+`json_serializable` · `drift`+SQLCipher · `flutter_secure_storage` · `shared_preferences` · `connectivity_plus` · `workmanager` · `geolocator` · `image_picker`/`camera` · `permission_handler` · `local_auth` · `sentry_flutter` · `mocktail`+`bloc_test`+`integration_test`.

---

## 14. Próximos passos (aguardando "go")

1. **Andaime** do projeto: flavors, DI (`get_it`/`injectable`), `go_router` com as duas cascas por perfil, tema/design tokens, l10n (4 idiomas) — sem regra de negócio.
2. Gerar o **cliente a partir do OpenAPI** e modelar o esquema do **Drift** (entregas, rota, POD, outbox, posições) + `SyncEngine`.
3. **Vertical slices** (valor primeiro), com o Motorista como caminho crítico:
   - **Auth** (login/registro por perfil, sessão, refresh) → roteia para a casca do perfil.
   - **Motorista:** Rota (otimizar) → Navegação (deep link) → **POD offline → sync** → Tracking.
   - **Empresa:** Dashboard (KPIs/AI Insights/POD) → Entregas → Rastreamento da frota.
4. Endurecer: testes (unit→bloc→repo→integração + contrato), segurança (pinning, DB cifrado, biometria) e CI/CD.

> Nada implementado ainda. Ao aprovar, começo pelo passo 1 (andaime) e sigo por slices, validando cada um.
