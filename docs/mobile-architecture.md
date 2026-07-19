# Navix Mobile (Flutter) — Arquitetura (Implementado)

> **Status:** Implementado · **Atualizado:** 2026-07-19
> Este documento descreve o app **como ele é hoje** (~10.600 linhas, 92 arquivos Dart,
> 10 features, 59 testes). A versão anterior era uma proposta ("sem código ainda"); a
> §12 registra as **decisões que mudaram** entre o plano e o que foi de fato adotado.

## 0. Contexto e escopo

O backend é uma API REST (`/api/v1`) NestJS, **multi-tenant** (tenant no JWT, RLS no Postgres), com **JWT RS256** (access) + **refresh token rotativo**, RBAC por papéis (`driver`, `admin`, `dispatcher`, `fleet_manager`).

O app atende **dois perfis** na mesma base, com cascas de navegação distintas escolhidas pelo papel:
- **Motorista** (autônomo e de empresa): rota, próxima entrega, inteligência da parada, mini-mapa, tracking, POD offline, assistente de voz; importar e otimizar as próprias entregas.
- **Empresa** (`admin`/`dispatcher`/…): dashboard operacional (KPIs), entregas, import center, rastreamento da frota, perfil — versão mobile enxuta (o Web segue como painel completo).

**Autenticação mobile:** o app usa **Bearer token** (header `Authorization`), diferente do web (cookie HttpOnly). O refresh token fica no armazenamento seguro (não em cookie).

---

## 1. Estado da implementação (features)

Organização **por feature**, cada uma com camadas `data` / `domain` / `presentation`. Núcleo transversal em `core/`. **Nenhuma feature é placeholder** — o `PlaceholderPage` não é mais usado por nenhuma casca.

| Feature | Linhas | Estado |
|---|---:|---|
| `driver` | ~1.445 | ✅ Dashboard do motorista: rota ("Minha rota — entrega X de N"), próxima entrega, `StopIntelligenceCard`, mini-mapa, captura de POD, banner de sync, botão "Otimizar minha rota" (S3), FAB de voz |
| `tracking` | ~960 | ✅ Compartilhamento de posição (motorista) + mapa/lista da frota (empresa) |
| `optimizer` | ~945 | ✅ Otimização assíncrona (enfileira → poll do job → plano). **Uma única página** para empresa e motorista, endpoint por papel via `OptimizerScope` (S3, ADR-0060) |
| `dashboard` | ~875 | ✅ Dashboard da empresa: KPIs (entregas, rotas, taxa de conclusão), séries, resumo POD, frota |
| `imports` | ~795 | ✅ Import Center (CSV/XLSX): preview com linhas válidas/inválidas, confirmação. Papel `driver` e empresa |
| `pod` | ~600 | ✅ Proof of Delivery: foto + assinatura + GPS, **fila offline** persistida em disco, sync ao reconectar |
| `intelligence` | ~600 | ✅ Assistente de voz (7 intents) + insights coletivos/estacionamento |
| `auth` | ~590 | ✅ Login e registro por perfil (Motorista × Empresa), sessão, refresh |
| `deliveries` | ~545 | ✅ Lista de entregas com filtro por status + estados; **widget compartilhado** entre empresa e motorista; FAB "Importar" no motorista (S0/S1/S2) |
| `profile` | ~55 | ⚠️ Mínimo (tema/idioma/sair). Ponto natural de evolução |

**Cascas de navegação** (`app/shell/`, `IndexedStack` + `NavigationBar`):
- **DriverShell:** Rota · Entregas · Perfil.
- **CompanyShell:** Dashboard · Entregas · Importar · Rastreamento · Perfil.

**Testes:** 18 arquivos, 59 testes (cubits: sucesso/vazio/erro; alguns widget tests). `flutter analyze` limpo.

```
lib/
├─ main_dev.dart / main_prod.dart      # entrypoints (NÃO há flavor de Xcode/Gradle — ver §11)
├─ app/
│  ├─ app.dart                         # MaterialApp.router + tema
│  ├─ router/app_router.dart           # go_router com redirect por papel
│  └─ shell/                           # DriverShell, CompanyShell (IndexedStack)
├─ core/
│  ├─ config/    network/    error/    session/    storage/    security/
│  ├─ location/  connectivity/ voice/  theme/      di/         logging/  ui/
└─ features/  (auth, dashboard, deliveries, driver, imports,
              intelligence, optimizer, pod, profile, tracking)
```

**Regra de dependência:** `presentation → domain ← data`. O `domain` não depende de Flutter. Mapeamento JSON↔modelo fica na `data` (feito à mão — ver §5).

---

## 2. Gerenciamento de estado — **Cubit** (`flutter_bloc` + `equatable`)

- **Cubit** em todas as telas (não se usa `Bloc`/eventos na prática). Estados imutáveis com **`equatable`** e `copyWith` **escrito à mão**.
- Padrão de estado: um enum de status (`loading/success/error`) + dados + mensagem de erro. Ex.: `DeliveriesCubit`, `DashboardCubit`, `OptimizerCubit`.
- Testes com **`bloc_test`** + **`mocktail`** (mock do repositório).

> **Mudou:** o plano previa `freezed` para estados. **Não foi adotado** — `equatable` + `copyWith` manual bastam e evitam codegen. (§12)

---

## 3. Navegação — **`go_router`** com redirect por papel

- `createRouter(SessionCubit)` (`app/router/app_router.dart`) com `refreshListenable` ligado ao stream da sessão.
- **Guarda por papel:** não autenticado → `/login`; autenticado → `s.isDriver ? /driver : /dashboard`; motorista não acessa rota de empresa e vice-versa.
- As duas cascas são widgets (`DriverShell`/`CompanyShell`) usando **`IndexedStack`** para preservar o estado das abas.

> **Mudou:** o plano citava `ShellRoute`/`StatefulShellRoute`. A implementação usa `GoRoute` simples + `IndexedStack` nas cascas. *Consequência conhecida:* como o `IndexedStack` mantém as abas vivas, telas não se auto-recarregam ao trocar de aba (ex.: o dashboard do motorista após importar exige pull-to-refresh ou é recarregado via callback). (§12)

---

## 4. Injeção de dependências — **`get_it` (registro manual)**

- Bootstrap único em `core/di/injector.dart`: `registerLazySingleton` (Dio, stores, repositórios), `registerFactory` (cubits), `registerSingleton` (serviços).
- Testes injetam fakes construindo os cubits diretamente com mocks (não via container).

> **Mudou:** o plano previa `injectable` (codegen). **Não foi adotado** — o registro manual é curto e explícito. (§12)

---

## 5. Comunicação com a API — **`dio` (cliente à mão)**

- `core/network/dio_client.dart` expõe dois clientes:
  - **`authDio`** — sem interceptor (login/registro/refresh, evita recursão).
  - **`apiDio`** — autenticado, com **`AuthInterceptor`**.
- **`AuthInterceptor`:** injeta o `Authorization: Bearer`; em `401`, faz **refresh single-flight** (um refresh por vez) e repete a requisição; falha no refresh → limpa a sessão.
- **Mapeamento de erro:** `dio_failure_mapper.dart` converte `DioException`/HTTP em **`Failure`** tipado (`core/error/failure.dart`: `NetworkFailure`, `ServerFailure`, `UnauthorizedFailure`). Os repositórios lançam `Failure`; os cubits capturam `on Failure` — **nada de exceção crua na UI**.
- **Parsing:** cada repositório lê o JSON e monta os modelos **à mão** (`fromJson`), lendo o envelope `{ data, meta }` da API.

> **Mudou:** o plano previa `retrofit` + `json_serializable` (cliente gerado do OpenAPI) e resultado `Either<Failure,T>` (`dartz`). **Nada disso foi adotado** — `dio` cru + `fromJson` manual + `Failure` lançado/capturado. (§12)

---

## 6. Armazenamento local

| Necessidade | Tecnologia real | Observação |
|---|---|---|
| Tokens / sessão | **`flutter_secure_storage`** (`SecureSessionStore`) | Keychain (iOS) / Keystore (Android) |
| Fila offline do POD | **Arquivos JSON em disco** (`path_provider` + `dart:convert`) | Um `.json` por POD enfileirado (`PodQueueStore`) |
| Mídia (foto, assinatura) | Arquivo em disco (`path_provider`), referenciado no item da fila | — |
| Tema/idioma | Guardado via `SecureSessionStore` / estado do `ThemeCubit` | — |

> **Mudou (a maior divergência):** o plano previa **Drift (SQLite) + SQLCipher** como fonte única da verdade, com queries reativas, e **`shared_preferences`**. **Nenhum foi adotado.** O offline hoje é uma **fila de arquivos JSON** para o POD — suficiente para o fluxo atual, mas **não** há banco local relacional nem cache reativo de entregas/rota. (§12)

---

## 7. Offline-First (estado real)

- **POD é offline-first de verdade:** captura (foto + assinatura + GPS) grava na fila em disco e reflete na UI; o envio é diferido. `PodSyncCubit` drena a fila ao reconectar (`connectivity_plus`) e reconcilia duplicidade (índice único no backend).
- **Entregas / rota NÃO são cacheadas offline** — são buscadas da API a cada abertura (sem banco local). O "stale-while-revalidate" do plano não existe hoje.
- **Conclusão honesta:** o app é **offline-first no POD** (o ponto crítico em campo) e **online** no resto. Um cache local de entregas/rota é evolução futura, não estado atual.

---

## 8. Sincronização

- **Fila do POD:** processada por `PodSyncCubit` — gatilhos de reconexão e ação do usuário; contador de pendências exposto ("itens aguardando envio").
- **Tracking:** posições enviadas ao backend (feature `tracking` + `core/location`).

> **Mudou:** o plano previa `workmanager` (background/WorkManager/BGTaskScheduler) e um `SyncEngine`/Outbox genérico. **Não há `workmanager`**; a sincronização é **em primeiro plano** (reconexão/ação), específica do POD. Background real é roadmap. (§12)

---

## 9. Segurança (estado real)

- ✅ **Tokens em secure storage**; refresh **single-flight** com limpeza de sessão em falha.
- ✅ **Bloqueio por biometria** (`local_auth`) — disponível.
- ✅ **Sem segredos no código**; a URL da API vem por `--dart-define=API_BASE_URL`.
- ⬜ **Certificate pinning** — previsto no plano, **não implementado**.
- ⬜ **Banco local criptografado (SQLCipher)** — não se aplica (não há banco local; a mídia do POD fica em arquivos no sandbox do app).
- ⬜ **Detecção de root/jailbreak**, **ofuscação de release** — roadmap.
- **Multi-tenant:** o app nunca confia em tenant do cliente; o isolamento é do backend (RLS + token).

---

## 10. Testes (estado real)

- ✅ **Cubit tests** (`bloc_test`+`mocktail`): sucesso / vazio / erro por fluxo (auth, dashboard, deliveries, optimizer — incl. caminho `mine`, pod sync, tracking, import…).
- ✅ **Alguns widget tests** (componentes do design system, `ImportFab`).
- ⬜ **Golden tests**, **`integration_test`**, **testes de contrato contra o OpenAPI** — previstos no plano, **ainda não** existem.
- **CI:** `flutter analyze` + `flutter test` rodam localmente; **não há job Flutter na CI do repositório** (a `ci.yml` cobre só API/web). Gate de mobile é local por ora.

---

## 11. Ambientes e localização

- **"Flavors" = só entrypoints** (`main_dev.dart` / `main_prod.dart`) + `--dart-define`. **NÃO** há flavor de Xcode/Gradle (`--flavor` **falha**). Não há `main_staging`.
  - Rodar: `flutter run -t lib/main_dev.dart --dart-define=API_BASE_URL=<url>`.
  - Default do dev: `http://10.0.2.2:3001/api/v1` (alias do emulador **Android**; no simulador iOS use `localhost` ou a URL de produção).
- **Localização:** pt-BR, pt-PT, en, es (+ `pt` genérico) via **`flutter_localizations` + ARB + `flutter gen-l10n`** (`lib/l10n/arb/*.arb` → `lib/l10n/gen/`, gerado no build). **Não** se usa `slang`.
- **Assistente de voz:** `speech_to_text` + `flutter_tts`, 7 intents (`mark_delivered`, `report_parking`, `next_stop`, `remaining`, `route_summary`, `help`, `unknown`) em pt/es/en.

---

## 12. Decisões que mudaram (plano → realidade)

| Tema | Proposto (doc anterior) | **Adotado** | Porquê |
|---|---|---|---|
| Estado | `freezed` | `equatable` + `copyWith` à mão | Evita codegen; suficiente |
| DI | `get_it` + `injectable` | `get_it` **manual** | Registro curto e explícito |
| Cliente HTTP | `dio` + `retrofit` + `json_serializable` (gerado do OpenAPI) | `dio` cru + `fromJson` à mão | Menos codegen; controle direto do envelope |
| Resultado | `Either<Failure,T>` (`dartz`) | `Failure` lançado/capturado | Padrão mais simples de cubit |
| Banco local | **Drift + SQLCipher** (fonte da verdade reativa) | **Nenhum** — só secure storage + fila de arquivos (POD) | Offline-first ficou no POD; cache de entregas é roadmap |
| Prefs | `shared_preferences` | Não usado | Coberto pelo secure storage / estado |
| Background sync | `workmanager` | Sync em primeiro plano (POD) | Background é roadmap |
| Navegação | `ShellRoute`/`StatefulShellRoute` | `GoRoute` + `IndexedStack` | Cascas por papel simples |
| l10n | `slang` | `flutter_localizations` + ARB + gen-l10n | Ferramenta oficial |
| Flavors | dev/staging/prod (Xcode/Gradle) | entrypoints + `--dart-define` (sem staging, sem flavor nativo) | — |
| Observabilidade | `sentry_flutter` | Não integrado | Roadmap |
| Segurança extra | pinning, root detection, ofuscação | Não implementados | Roadmap |
| Otimização | chamada síncrona a `/route-plans` | **assíncrona** (enfileira → poll → plano), endpoint por papel | Backend migrou para fila de jobs; ADR-0060 |

**Decisões que se mantiveram:** Cubit (`flutter_bloc`), `go_router` com guarda por papel, dois perfis (Motorista + Empresa), `dio`, `flutter_secure_storage`, `local_auth`, 4 locales, navegação em mapa por deep link (turn-by-turn embarcado segue como fase futura).

---

## 13. Stack real (resumo)

`flutter_bloc` · `equatable` · `get_it` · `go_router` · `dio` · `flutter_secure_storage` · `connectivity_plus` · `geolocator` · `image_picker` · `file_picker` · `signature` · `path_provider` · `local_auth` · `speech_to_text` · `flutter_tts` · `intl` · (dev) `mocktail` · `bloc_test` · `flutter_lints`.

---

## 14. Roadmap (o que falta em relação à visão)

1. **Cache local de entregas/rota** (offline-first além do POD) — hoje é online; avaliar Drift ou solução leve.
2. **Sincronização em background** (`workmanager`) e **push** (FCM/APNs) para novas rotas.
3. **Observabilidade** (`sentry_flutter` com redaction) e **CI de mobile** (job `flutter analyze`+`test` no GitHub Actions).
4. **Segurança de release:** certificate pinning, ofuscação, detecção de integridade.
5. **Testes:** golden (design system), `integration_test` (login → otimizar → POD offline → sync), contrato contra o OpenAPI.
6. **`profile`**: hoje mínimo — expandir (dados da conta, preferências, gestão de sessão).
7. **Auto-refresh entre abas** (o `IndexedStack` mantém estado; avaliar recarregar no foco da aba).
