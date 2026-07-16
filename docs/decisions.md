# Registro de decisões (ADRs) — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.4 · **Atualizado:** 2026-07-12

Este arquivo mantém os **Architecture Decision Records**. Toda decisão técnica significativa (arquitetura, stack, segurança, dados, processo) deve ser registrada aqui, de forma imutável. Decisões não se apagam: quando mudam, cria-se um novo ADR que **supera** (supersedes) o anterior.

> **Duas dimensões distintas.** O **Status** reflete a maturidade da decisão *e* do seu enforcement no código; a coluna **Status da implementação** descreve, de forma objetiva, o que já existe no repositório hoje. Uma decisão pode estar tecnicamente aprovada mas ainda **não construída** — nesse caso o Status é `Planejado` (nada implementado) ou `Parcial` (parte implementada), **nunca `Aceito`**. `Aceito` fica reservado para decisões cujo escopo essencial já está implementado e ativo.

## Como registrar um ADR

1. Copie o [template](#template) para o fim da lista.
2. Numere sequencialmente (`ADR-0001`, `ADR-0002`, …).
3. Defina o status: `Proposto` · `Planejado` · `Parcial` · `Aceito` · `Rejeitado` · `Substituído` · `Depreciado`.
   - `Planejado` — decisão registrada, **ainda não implementada** (roadmap).
   - `Parcial` — **parte** da decisão implementada; o restante é roadmap (detalhar na implementação).
   - `Aceito` — escopo essencial **implementado e ativo** no código.
4. Preencha também o **Status da implementação** (o que existe hoje, com precisão).
5. Abra no mesmo PR da mudança que a decisão afeta.

**Legenda do Status da implementação:** ✅ Implementado · 🟡 Parcial · ⬜ Planejado.

## Índice

| ID | Título | Status | Status da implementação | Data |
|----|--------|--------|-------------------------|------|
| ADR-0000 | Adoção do processo de ADR | Aceito | ✅ Em uso (este arquivo) | 2026-07-05 |
| ADR-0001 | Stack de backend: NestJS + TypeScript | Aceito | ✅ Implementado | 2026-07-05 |
| ADR-0002 | Persistência: PostgreSQL + PostGIS e Redis | Parcial | 🟡 Postgres+PostGIS em uso; Redis ativo no rate limiting; cache/filas com abstração pronta (ainda não consumida) | 2026-07-05 |
| ADR-0003 | Estratégia de multi-tenancy inicial | Aceito | ✅ Implementado (enforcement no ADR-0012) | 2026-07-05 |
| ADR-0004 | Autenticação com JWT + Refresh Token | Aceito | ✅ Núcleo implementado; blacklist Redis e MFA/M2M pendentes | 2026-07-05 |
| ADR-0005 | ORM: TypeORM (compatível com RLS) | Aceito | ✅ Implementado | 2026-07-05 |
| ADR-0006 | Transactional Outbox para eventos de domínio | Parcial | 🟡 Só a tabela `outbox`; sem producer/relay/consumer | 2026-07-05 |
| ADR-0007 | Motor de otimização como serviço isolável (port) | Parcial | 🟡 Assíncrono via job (202 + jobId, status endpoint, port de fila); fila **in-process** (BullMQ/durável pendente) | 2026-07-05 |
| ADR-0008 | Chaves primárias UUIDv7 (ordenáveis) | Aceito | ✅ Implementado (`newId()` via `uuid` v7) | 2026-07-05 |
| ADR-0009 | Telemetria de posições em série temporal | Parcial | 🟡 Tabela `driver_positions` pronta; TimescaleDB **não** habilitado | 2026-07-05 |
| ADR-0010 | Envelope encryption com chave por tenant | Planejado | ⬜ Não implementado; PII em texto puro; `ENCRYPTION_KEK` sem uso | 2026-07-05 |
| ADR-0011 | CQRS leve com read models para relatórios | Planejado | ⬜ Não implementado; dashboards leem o OLTP direto | 2026-07-05 |
| ADR-0012 | RLS forçada + interceptor de tenant por transação | Aceito | ✅ Implementado (FORCE + role `navix_app` + interceptor) | 2026-07-06 |
| ADR-0013 | Access token JWT RS256 com key ring e rotação | Aceito | ✅ Implementado | 2026-07-06 |
| ADR-0014 | Rate limiting com @nestjs/throttler | Aceito | ✅ Throttler global + login/refresh estritos; storage **Redis** (multi-instância) com fallback em memória | 2026-07-06 |
| ADR-0015 | Autenticação separada: Web (cookie) e Mobile (bearer) por endpoints dedicados | Aceito | ✅ `/auth/*` cookie (web) e `/auth/mobile/*` bearer (mobile); header `X-Auth-Mode` eliminado | 2026-07-13 |
| ADR-0016 | Login sem `tenantId`: tenant resolvido por e-mail (ou slug da empresa) | Aceito | ✅ `LoginRequest { email, password, organization? }`; e-mail global único + `tenants.slug` | 2026-07-13 |
| ADR-0017 | Idempotency-Key nas operações críticas (offline) | Aceito | ✅ Interceptor `@Idempotent()` + tabela `idempotency_keys`; aplicado em POD, tracking, import/confirm e otimização | 2026-07-13 |
| ADR-0018 | Transporte em tempo real por SSE (ticket de conexão) | Aceito | ✅ `RealtimeHub` + `/realtime/ticket` + `/realtime/stream`; tracking e jobs publicam; polling só como fallback | 2026-07-13 |
| ADR-0019 | Mídia do Proof of Delivery em object storage (StorageService) | Aceito | ✅ `StoragePort` + drivers `local`/`s3` (S3/R2/GCS); banco guarda só a URL; aceita data URL por compatibilidade temporária | 2026-07-13 |
| ADR-0020 | Sincronização incremental offline-first (updatedSince + cursor de keyset) | Aceito | ✅ `GET /deliveries/sync` (delta + tombstones, keyset `(updated_at,id)`, índice dedicado); contratos `SyncParams`/`SyncResponse<T>` genéricos | 2026-07-14 |
| ADR-0021 | Observabilidade de produção (OpenTelemetry + Prometheus + health) | Aceito | ✅ Logs pino c/ correlação de trace; métricas `prom-client` em `/metrics`; tracing OTel opt-in (http/pg/ioredis); `/health/{live,ready}` (Redis não fatal); stack Grafana/Jaeger | 2026-07-14 |
| ADR-0022 | Motor de otimização: modelo rico de restrições + perfil por veículo | Aceito | ✅ Fases 1–2: demanda/capacidade, serviço por parada, `VehicleProfile` por tipo; **multi-veículo** por clustering de sweep (`routes[]` + não atribuídas) | 2026-07-14 |
| ADR-0023 | Reotimização automática por eventos + priorização dinâmica por SLA | Aceito | ✅ `DomainEventBus` in-process; Delivery publica eventos; `AutoReoptimizationService` (debounce por tenant, opt-in) + `POST /route-plans/reoptimize`; peso de prioridade por proximidade do prazo | 2026-07-14 |
| ADR-0024 | Estratégia metaheurística (VND) + sobretaxas de pedágio/zona de risco | Aceito | ✅ Estratégia `or-opt-2opt` (Or-opt + 2-opt) pela mesma port; `CostAugmentationPort` alimenta o *seam* de custo — zonas de risco configuráveis (no-op default); path aberto para OR-Tools nativo e provedor de pedágio | 2026-07-14 |
| ADR-0025 | Navix Intelligence — 1ª camada (heurísticas atrás de ports, ML-ready) | Aceito | ✅ `POST /intelligence/route-forecast`: cronograma/ETA + conclusão, atrasos+mitigação, combustível, melhor horário de saída, trânsito por contexto temporal e perfil de motorista; tudo em serviços de domínio + ports (`TrafficModelPort`/`DriverProfileSourcePort`) prontos para ML/LLM | 2026-07-14 |
| ADR-0026 | Modo Economia — otimizar por tempo/combustível/pedágio/CO₂ | Aceito | ✅ `economyMode` mapeia preset de pesos sobre o motor existente (reuso ADR-0022/24); estimativa de CO₂ na métrica; seletor no web (DS + i18n 4 locales + a11y). Diferenciação fina de tempo/pedágio real depende do provedor de mapas (próximo PR) | 2026-07-14 |
| ADR-0027 | Provedor de mapas/roteamento (Mapbox) com fallback Haversine | Aceito | ✅ `RoutingProviderPort` (matriz distância+duração assíncrona); adaptador Mapbox Matrix API (real, opt-in por `MAPS_PROVIDER`+`MAPBOX_TOKEN`) degrada para Haversine em qualquer falha; solver refatorado para async | 2026-07-15 |
| ADR-0028 | Navegação contextual — instruções de acesso ao destino | Aceito | ✅ `AccessInstructionsPort` (classificador heurístico de `accessNotes`) estende o route-forecast; `access[]` por parada (porta/doca/interfone/código/portaria/nota); componente web `AccessInstructionList` (DS/i18n/a11y). Fecha a Fase A | 2026-07-15 |
| ADR-0029 | Previsão inteligente de estacionamento (Fase B) | Aceito | ✅ `ParkingPredictorPort` (heurística que reusa `TrafficModelPort` como proxy de congestionamento, ML-ready) anexa `parking` (dificuldade fácil/moderado/difícil + confiança + minutos a pé) por parada no route-forecast; componente web `ParkingBadge` (DS/i18n 4 locales/a11y). Abre a Fase B | 2026-07-15 |
| ADR-0030 | Organização otimizada da carga (Fase B) | Aceito | ✅ `POST /intelligence/load-plan`: `LoadPlannerPort` (heurística **LIFO** — última entrega ao fundo, ML-ready p/ bin packing 3D) devolve sequência de carregamento, zonas de estiva (porta/meio/fundo), ocupação de peso/volume e avisos (excesso, frágil sob carga); capacidade explícita ou por tipo de veículo; componente web `LoadPlanList` (DS/i18n 4 locales/a11y). Fecha a Fase B | 2026-07-15 |
| ADR-0031 | Inteligência coletiva por tenant (Fase C) | Aceito | ✅ `POST /intelligence/observations` + `GET /intelligence/insights`: observações de campo do motorista (estacionamento/tempo de atendimento/dica de acesso) persistidas por tenant (RLS FORCE) e agregadas por **célula de localização** (~110 m) atrás do `CollectiveInsightsPort`; agregação pura (moda/mediana/dedup) com **amostra mínima** (privacidade); componente web `CollectiveInsightCard` (DS/i18n 4 locales/a11y). Abre a Fase C | 2026-07-15 |
| ADR-0032 | Assistente por voz do motorista (Fase C) | Aceito | ✅ `POST /intelligence/voice-command`: `VoiceCommandInterpreterPort` (heurística de intenção por palavras-chave PT/EN/ES, ML-ready p/ NLU/LLM) classifica a transcrição em intenção (próxima parada/resumo/quanto falta/entregue/estacionamento/ajuda) + slots; STT/TTS no navegador (Web Speech API) via componente `VoiceAssistantButton` com _fallback_ elegante (DS/i18n 4 locales/a11y). **Fecha a Fase C e os 6 recursos do motorista** | 2026-07-15 |
| ADR-0033 | Montagem da experiência do motorista na tela (integração A) | Aceito | ✅ A página do motorista passa a **renderizar** os 6 recursos: `VoiceAssistantButton` no cabeçalho + `DriverStopIntelligence` (estacionamento/acesso/coletiva/carga) na parada atual, guiado pela previsão/carga derivadas do plano de rota. Componente **apresentacional** (dados via props) + consultas na página. Abre a fase de integrações | 2026-07-16 |
| ADR-0034 | Estacionamento ciente da comunidade (integração B) | Aceito | ✅ `ParkingPredictorPort` torna-se **assíncrona + por tenant**; `CommunityAwareParkingPredictor` parte da heurística de trânsito (ADR-0029) e a **realimenta** com o que a frota observou na célula (ADR-0031) via `blendParking` puro (a observação real puxa a dificuldade pela sua confiança); degrada para a heurística sem observações. Fecha o laço de realimentação | 2026-07-16 |
| ADR-0035 | Ações do assistente de voz + captura automática (integrações C+D) | Aceito | ✅ O `onIntent` do `VoiceAssistantButton` liga a intenção às **ações reais** (marcar entregue, reportar estacionamento→observação, próxima parada/quanto falta/resumo→resposta com dados); ao concluir uma parada, o **tempo de atendimento** (dwell) é registrado automaticamente como observação `service_time` (ADR-0031). Realimenta a coletiva sem esforço do motorista. Web-only, reusa `recordObservation` | 2026-07-16 |

---

## ADR-0000 — Adoção do processo de ADR

- **Status:** Aceito · **Data:** 2026-07-05
- **Status da implementação:** ✅ Processo em uso — este arquivo mantém os ADRs versionados junto ao código.
- **Contexto:** Precisamos registrar decisões técnicas de forma rastreável e durável.
- **Decisão:** Adotar ADRs neste arquivo, imutáveis e versionados junto ao código.
- **Consequências:** Histórico claro de "por que" cada escolha foi feita; leve overhead por decisão.

## ADR-0001 — Stack de backend: NestJS + TypeScript

- **Status:** Aceito · **Data:** 2026-07-05
- **Status da implementação:** ✅ Implementado — API em NestJS 10 + TypeScript `strict`, com módulos em Clean Architecture.
- **Contexto:** Precisamos de um framework que favoreça modularidade, DI e Clean Architecture/DDD.
- **Decisão:** Node.js + **NestJS** com **TypeScript** em modo strict.
- **Alternativas consideradas:** Express/Fastify puro (mais leve, porém mais boilerplate estrutural).
- **Consequências:** DI e modularização nativas alinhadas à arquitetura; curva de aprendizado do Nest; acoplamento a convenções do framework contido na camada de interface/infra.

## ADR-0002 — Persistência: PostgreSQL + PostGIS e Redis

- **Status:** Parcial · **Data:** 2026-07-05
- **Status da implementação:** 🟡 Parcial. **PostgreSQL 16 + PostGIS** em uso: extensão criada no init do container e coluna `location geography(Point,4326)` gerada em `deliveries`. **Redis 7** agora tem uma conexão compartilhada resiliente (`shared/redis`, `REDIS_CLIENT`) e **já é usado no rate limiting** (ADR-0014). As abstrações de **cache** (`CachePort`/`RedisCache`) e de **fila** (`QueuePort`/`RedisQueue`) estão prontas e registradas, mas **ainda não são consumidas** por nenhum módulo (infraestrutura preparada, sem alterar comportamento). Blacklist de tokens e a fila definitiva (BullMQ) seguem como roadmap.
- **Contexto:** O domínio é fortemente geoespacial e exige cache/filas de baixa latência.
- **Decisão:** **PostgreSQL 16 + PostGIS** como fonte de verdade; **Redis 7** para cache, filas, sessões e rate limiting.
- **Alternativas consideradas:** Postgres sem PostGIS + cálculo externo; bancos NoSQL geoespaciais.
- **Consequências:** Consultas espaciais nativas e maduras; necessidade de expertise em PostGIS e em modelagem multi-tenant.

## ADR-0003 — Estratégia de multi-tenancy inicial

- **Status:** Aceito · **Data:** 2026-07-05
- **Status da implementação:** ✅ Implementado. Todas as tabelas de negócio têm `tenant_id` + RLS; o enforcement completo (FORCE + role de runtime + interceptor) está descrito e implementado no **ADR-0012**.
- **Contexto:** Produto SaaS multi-tenant global; isolamento de dados é crítico.
- **Decisão:** Banco único com coluna `tenant_id` + **Row-Level Security (RLS)**, reforçado por filtro na aplicação.
- **Alternativas consideradas:** Schema-por-tenant; database-por-tenant (mais isolamento, mais custo operacional).
- **Consequências:** Simplicidade e custo baixo no início; evolução para schema/DB por tenant prevista para enterprise/residência de dados (exigirá novo ADR).

## ADR-0004 — Autenticação com JWT + Refresh Token

- **Status:** Aceito · **Data:** 2026-07-05
- **Status da implementação:** ✅ Núcleo implementado. Access token JWT (RS256 — ver ADR-0013) + refresh token opaco, **hasheado** e **rotacionado** a cada uso, com **detecção de reuso** que revoga a família inteira (`refresh-token.use-case.ts`) e logout que revoga o token. **Pendências (roadmap):** blacklist de tokens no Redis, MFA para contas administrativas e autenticação M2M (OAuth2/API keys — a tabela `api_keys` existe, mas não há fluxo de autenticação por API key).
- **Contexto:** APIs stateless multi-tenant precisam de autenticação segura e escalável.
- **Decisão:** **JWT** de curta duração + **Refresh Token** rotacionado e revogável (hash no banco), com detecção de reuso.
- **Alternativas consideradas:** Sessões server-side puras; tokens opacos com introspecção.
- **Consequências:** Escalabilidade stateless; complexidade de rotação/revogação e necessidade de blacklist no Redis. Detalhes em [security.md](./security.md).

## ADR-0005 — ORM: TypeORM (compatível com RLS)

- **Status:** Aceito · **Data:** 2026-07-05
- **Status da implementação:** ✅ Implementado — TypeORM com migrações versionadas, `DataSource` direto para DDL e repositórios "transaction-aware" que participam da transação de tenant (RLS).
- **Contexto:** A estratégia de multi-tenancy (ADR-0003) depende de definir `SET app.current_tenant` por transação e de RLS. Precisávamos resolver a decisão de ORM que estava em aberto.
- **Decisão:** Adotar **TypeORM**, que permite controle transacional explícito, execução de SQL bruto e definição de variáveis de sessão por conexão — requisitos para RLS confiável e para consultas geoespaciais (PostGIS).
- **Alternativas consideradas:** **Prisma** (DX excelente, porém suporte histórico limitado a variáveis de sessão/RLS e a tipos PostGIS); **Drizzle** (leve, mas ecossistema menos maduro para este caso).
- **Consequências:** Mais boilerplate que Prisma; em troca, RLS e PostGIS bem suportados. Repositórios ficam atrás de *ports* do domínio, então uma futura troca de ORM fica contida na infraestrutura.

## ADR-0006 — Transactional Outbox para eventos de domínio

- **Status:** Parcial · **Data:** 2026-07-05
- **Status da implementação:** 🟡 Parcial — **apenas a tabela `outbox`** foi criada (migração `InitPhase0`, com índice de não-publicados). **Não há** gravação de eventos na transação dos agregados, **nem relay**, **nem consumidores** — nenhum evento de domínio é emitido ou publicado hoje. Efetivamente ainda no roadmap; a base de schema já está pronta.
- **Contexto:** Publicar eventos (ex.: `RoutePlanned`) e gravar estado no banco em operações separadas cria *dual-write* — risco de perder eventos ou emitir eventos de transações que falharam.
- **Decisão:** Usar o padrão **Transactional Outbox**: o evento é gravado na mesma transação do agregado, e um *relay* assíncrono publica na fila (Redis/BullMQ hoje, broker dedicado no futuro). Consumidores são **idempotentes**.
- **Alternativas consideradas:** Publicação direta pós-commit (sujeita a perda); 2PC/XA (complexo e pouco escalável).
- **Consequências:** Garante consistência eventual confiável entre estado e eventos; adiciona uma tabela `outbox` e um processo de relay. Base para reotimização em tempo real (Fase 2) e ML (Fase 3).

## ADR-0007 — Motor de otimização como serviço isolável (port)

- **Status:** Parcial · **Data:** 2026-07-05
- **Status da implementação:** 🟡 Parcial (avançado). A otimização agora é **assíncrona por jobs**: `POST /route-plans` (e `/mine`) **enfileira** e responde **`202 Accepted` + `jobId`**; o status é consultado em `GET /route-plans/jobs/:jobId` (polling). Um processador reusa o solver (`OptimizeRouteUseCase`) fora da requisição, atualizando o job (`queued→running→succeeded/failed`) e emitindo transições por uma `JobEventsPort` — **base pronta para WebSocket/SSE**. A **port de fila** (`OptimizationJobQueuePort`) isola o transporte. **Pendente:** a fila é **in-process** (`setTimeout`, não-durável a reinícios) — a troca por **BullMQ**/worker dedicado é o próximo passo, sem alterar os casos de uso. A estratégia (nearest-neighbor + 2-opt) e o gateway anti-corrupção para o Delivery seguem isolados.
- **Contexto:** A resolução do VRP é CPU-intensiva, tem perfil de escala diferente da API e pode exigir linguagem/solver especializados. Embutir a lógica no request bloquearia o processo e dificultaria a extração futura.
- **Decisão:** Definir o otimizador atrás de uma **port** (`RouteOptimizer`) desde o início, executado de forma **assíncrona via fila** e **stateless**. Começa in-process/worker no MVP, mas com contrato que permite extrair para microserviço com escala horizontal sem reescrita.
- **Alternativas consideradas:** Solver acoplado ao caso de uso (mais simples, porém difícil de escalar/extrair).
- **Consequências:** Leve overhead de abstração no MVP; ganho grande de escalabilidade e de liberdade de tecnologia do solver depois.

## ADR-0008 — Chaves primárias UUIDv7 (ordenáveis)

- **Status:** Aceito · **Data:** 2026-07-05
- **Status da implementação:** ✅ Implementado — `shared/kernel/id.ts` (`newId()`) gera UUIDv7 via `uuid`; todas as PKs são geradas na aplicação.
- **Contexto:** UUIDv4 é aleatório e, em escala de milhões de linhas, fragmenta índices B-tree e degrada inserção/locality.
- **Decisão:** Usar **UUIDv7** (ordenável por tempo) como PK padrão. Mantém a vantagem de não-enumerável, com *locality* de índice próxima a um inteiro sequencial.
- **Alternativas consideradas:** UUIDv4 (fragmentação); BIGSERIAL (enumerável, ruim para multi-tenant exposto); ULID (equivalente, porém UUIDv7 é padrão e nativo em ferramentas).
- **Consequências:** Melhor performance de escrita e de índice em alta escala; exige gerador UUIDv7 (lib) até suporte nativo no Postgres.

## ADR-0009 — Telemetria de posições em série temporal

- **Status:** Parcial · **Data:** 2026-07-05
- **Status da implementação:** 🟡 Parcial. A tabela `driver_positions` existe (RLS + FORCE, índice `(tenant_id, driver_id, recorded_at DESC)`, grants ao role de runtime) e está **preparada** para virar hypertable, mas a extensão **TimescaleDB não está habilitada** — segue como tabela Postgres comum. Compressão, *retention* e *downsampling* são roadmap (Fase 2). Observação: a tabela real chama-se `driver_positions` (o esquema histórico em [database.md](./database.md) referia `vehicle_positions`).
- **Contexto:** `vehicle_positions` é o maior volume do sistema (milhões de pontos/dia em escala) e tem perfil de escrita e retenção distinto do OLTP transacional.
- **Decisão:** Armazenar posições em store de **série temporal** — **TimescaleDB** (extensão do próprio Postgres) com *hypertables*, compressão e *retention/downsampling* — separado das tabelas transacionais.
- **Alternativas consideradas:** Tabela Postgres comum particionada (funciona, mas sem compressão/downsampling nativos); store dedicado externo (mais peças operacionais no MVP).
- **Consequências:** Escala de ingestão e custo de storage controlados, mantendo SQL/PostGIS. Introduz a extensão TimescaleDB na stack.

## ADR-0010 — Envelope encryption com chave por tenant

- **Status:** Planejado · **Data:** 2026-07-05
- **Status da implementação:** ⬜ **Não implementado.** A variável `ENCRYPTION_KEK` é validada no `env.schema`, mas **não há nenhum uso de criptografia de campo** no código (sem AES-256-GCM, sem DEK por tenant, sem KMS, sem crypto-shredding). Dados de PII (telefone, nome, endereço completo, foto/assinatura de comprovante) estão **em texto puro** no banco. Enquanto este ADR não for implementado, a documentação **não deve** presumir cifragem em repouso.
- **Contexto:** SaaS global com PII exige isolamento criptográfico forte e suporte a residência de dados e a "direito ao esquecimento".
- **Decisão:** **Envelope encryption**: cada tenant tem uma **DEK** (Data Encryption Key) própria, protegida por uma **KEK** no KMS. Dados sensíveis são cifrados com AES-256-GCM usando a DEK do tenant. *Crypto-shredding* (destruir a DEK) permite exclusão lógica irreversível.
- **Alternativas consideradas:** Chave única global (raio de exposição maior, sem crypto-shredding por tenant).
- **Consequências:** Isolamento e conformidade mais fortes; exige KMS e versionamento/rotação de chaves. Detalhes em [security.md](./security.md).

## ADR-0011 — CQRS leve com read models para relatórios

- **Status:** Planejado · **Data:** 2026-07-05
- **Status da implementação:** ⬜ **Não implementado.** Não há read models, tabelas de leitura materializadas nem réplicas de leitura; dashboards e listagens consultam o OLTP diretamente. Depende do outbox (ADR-0006), também pendente.
- **Contexto:** Dashboards e relatórios de eficiência (KPIs de [vision.md](./vision.md)) fazem agregações pesadas que competem com o OLTP e não escalam para milhares de tenants.
- **Decisão:** **CQRS leve**: manter escrita normalizada e projetar **read models** (materializações/tabelas de leitura, alimentadas por eventos do outbox) para consultas analíticas, servidas por **réplicas de leitura**.
- **Alternativas consideradas:** Consultar direto o OLTP (não escala); data warehouse completo (over-engineering para o estágio atual).
- **Consequências:** Leitura escalável e barata; custo de manter projeções consistentes. Evolui para warehouse dedicado quando a Fase 3 (Intelligence) exigir.

## ADR-0012 — RLS forçada + interceptor de tenant por transação

- **Status:** Aceito · **Data:** 2026-07-06
- **Status da implementação:** ✅ Implementado. `FORCE ROW LEVEL SECURITY` + política `tenant_isolation` (com `WITH CHECK`) em **todas** as tabelas de negócio (fleet, delivery, route_plans, imports, tracking, pod, user_settings, user_profiles); a aplicação conecta como o role não-superusuário `navix_app` (`CreateAppRole`); e o `TenantTransactionInterceptor` abre transação por request autenticado com `set_config('app.current_tenant', …, true)`. Coberto pelo e2e `test/tenant-isolation.e2e-spec.ts`.
- **Contexto:** A RLS existia (ENABLE) mas o app conectava como owner das tabelas, que contorna RLS — o isolamento era só de aplicação (ADR-0003 pendente de enforcement).
- **Decisão:** Três partes: (1) RLS + `FORCE` nas tabelas de **negócio** (vehicles, drivers, deliveries, route_plans); (2) a aplicação conecta com um **role de runtime não-superusuário** (`navix_app`) — **essencial**, pois superusuários/owners IGNORAM a RLS mesmo com FORCE (migrações/seed continuam com o owner); (3) um `TenantTransactionInterceptor` abre uma transação por request autenticado e faz `set_config('app.current_tenant', <tenant>, true)`; os repositórios resolvem o EntityManager da transação, então toda query passa pela RLS. As tabelas de **auth** (users, refresh_tokens) ficam **sem RLS** (login/refresh consultam usuários antes de haver tenant) — isolamento no nível de aplicação.
- **Alternativas consideradas:** Só FORCE conectando como owner (FALHA — o owner era superusuário e ignorava a RLS; corrigido com o role de runtime). Enforcement só na aplicação (não protege contra bugs de código).
- **Consequências:** Isolamento de negócio garantido pelo banco, mesmo com bug de aplicação. Exige um role de runtime (criado pela migração `CreateAppRole`) e separação owner/app. Overhead de uma transação por request autenticado; repositórios ficaram "transaction-aware".

## ADR-0013 — Access token JWT RS256 com key ring e rotação

- **Status:** Aceito · **Data:** 2026-07-06
- **Status da implementação:** ✅ Implementado. `JwtTokenService` assina com **RS256** e `kid` no cabeçalho; a verificação seleciona a chave pública pelo `kid` via `KeyRing` (implementação local `LocalKeyRing`, com par efêmero gerado no boot em dev e chave pública anterior para rotação). Migração para KMS/HSM fica contida atrás da port.
- **Contexto:** O access token usava HS256 (segredo simétrico), inadequado para produção e para futura verificação por terceiros.
- **Decisão:** Migrar para **RS256** (assimétrico). Assinatura com chave privada e `kid` no cabeçalho; verificação seleciona a chave pública pelo `kid` (permite **rotação** sem invalidar tokens em voo). Tudo atrás de uma porta `KeyRing` — a implementação local (chaves em env, ou par efêmero em dev) troca por **KMS/HSM** no futuro sem alterar o serviço de tokens. Refresh tokens continuam opacos (inalterados).
- **Alternativas consideradas:** Manter HS256 (inseguro para escala/externos); JWKS remoto já agora (over-engineering para o estágio).
- **Consequências:** Base pronta para KMS e para expor verificação. Requer gestão de chaves (env/secret manager) em produção.

## ADR-0014 — Rate limiting com @nestjs/throttler

- **Status:** Aceito · **Data:** 2026-07-06
- **Status da implementação:** ✅ Implementado. `@nestjs/throttler` global (120/min) ativo como `APP_GUARD`, com limites **estritos** por rota via `@Throttle` (`register` e `login` 5/min, `refresh` 20/min). O **storage agora é Redis** (`ThrottlerStorageRedis`, contagem atômica via script Lua `INCR`+`PEXPIRE`+`PTTL`), compartilhando o contador entre instâncias. Há **fallback automático para memória** quando o Redis está indisponível — então o comportamento em ambientes sem Redis é idêntico ao anterior (mesmos limites).
- **Contexto:** A API não tinha proteção contra força bruta/abuso.
- **Decisão:** `@nestjs/throttler` global (limite amplo) + limites **estritos** no `login` (5/min) e `refresh` (20/min). Armazenamento em memória no MVP.
- **Alternativas consideradas:** Rate limit em proxy/gateway (válido, mas não protege por rota/tenant no app).
- **Consequências:** Proteção imediata contra força bruta. Em produção, migrar o storage para **Redis** (já disponível) para funcionar com múltiplas instâncias.

## ADR-0015 — Autenticação separada: Web (cookie) e Mobile (bearer) por endpoints dedicados

- **Status:** Aceito · **Data:** 2026-07-13
- **Status da implementação:** ✅ Implementado. Web usa `/api/v1/auth/*` (cookie HttpOnly, corpo sem refresh token); Mobile usa `/api/v1/auth/mobile/*` (refresh token no corpo, obrigatório). Os dois compartilham os mesmos casos de uso (`LoginUseCase`, `RegisterUseCase`, `RefreshTokenUseCase`, `LogoutUseCase`) e um resultado de aplicação client-agnostic (`AuthResult`); cada controller mapeia para o contrato do seu cliente (`WebAuthResponse` vs `MobileAuthResponse`). O header `X-Auth-Mode` foi **eliminado**.
- **Contexto:** A primeira versão do fluxo de cookie usava um header `X-Auth-Mode: bearer` para, nos **mesmos** endpoints, decidir se o refresh token ia no cookie (web) ou no corpo (mobile). Isso criava acoplamento implícito e frágil: qualquer cliente/instância de Dio que esquecesse o header recebia login **sem** refresh token e quebrava em silêncio (risco #1 da análise do app Flutter).
- **Decisão:** Separar por **endpoints dedicados**. `/auth/*` é exclusivamente web (cookie); `/auth/mobile/*` é exclusivamente mobile (bearer). Contratos explícitos por cliente. Endpoints de conta (`me`, troca/reset de senha) permanecem **compartilhados** — dependem do access token, não da forma de entrega do refresh.
- **Alternativas consideradas:** Manter o header `X-Auth-Mode` (acoplamento implícito, footgun); negociação por `Accept`/User-Agent (mágica e frágil); um só endpoint sempre com refresh no corpo (perde a proteção XSS do cookie no web).
- **Consequências:** Web e mobile ficam desacoplados e auto-documentados; o contrato mobile é explícito (refresh token sempre presente). Custo: um controller a mais e leve duplicação de rotas — compensado pela clareza e por eliminar o footgun. Supersede o mecanismo de header introduzido junto ao cookie (ADR-0013/hardening).

## ADR-0016 — Login sem `tenantId`: tenant resolvido por e-mail (ou slug da empresa)

- **Status:** Aceito · **Data:** 2026-07-13
- **Status da implementação:** ✅ Implementado. `LoginRequest`/`ForgotPasswordRequest` passam a `{ email, password, organization? }` — sem `tenantId` (UUID). Resolução: se `organization` (slug da empresa) for informado, busca o usuário por e-mail dentro daquele tenant; senão resolve o tenant pelo **e-mail** (agora identidade **global**). A migração `TenantSlugAndEmailIdentity` adiciona `tenants.slug` (único) e um índice único global de e-mail em `users`; o register gera um slug único e rejeita e-mail duplicado.
- **Contexto:** Exigir o `tenantId` (UUID) no login era um bloqueio de UX — especialmente para o app Flutter (motoristas não conhecem o UUID do tenant). Era o risco #2 da análise do app Flutter.
- **Decisão:** O e-mail é a identidade primária e resolve o tenant automaticamente; o `slug` da empresa é uma alternativa opcional para desambiguar. Não se exige mais o `tenantId` no corpo.
- **Alternativas consideradas:** Resolver por subdomínio/host (adia o problema para infra de DNS; não serve ao mobile); manter `tenantId` (UX ruim); permitir e-mail repetido entre tenants com desambiguação obrigatória (vaza existência de e-mail e complica o cliente).
- **Consequências:** Login e recuperação de senha ficam com UX padrão de mercado (só e-mail + senha). Assume-se **e-mail globalmente único** — a associação de um mesmo usuário a múltiplos tenants (multi-org) passará a exigir uma tabela de *membership* dedicada quando/se for necessária. **Compatível com a RLS:** a resolução ocorre em `users`/`tenants` (sem RLS, fluxo público pré-tenant); o `tenant_id` continua vindo do JWT para todo o resto.

## ADR-0017 — Idempotency-Key nas operações críticas (offline)

- **Status:** Aceito · **Data:** 2026-07-13
- **Status da implementação:** ✅ Implementado. Um `IdempotencyInterceptor` global (registrado após o `TenancyModule`, para rodar **dentro** da transação de tenant) atende os endpoints marcados com `@Idempotent()` quando o cliente envia o header `Idempotency-Key`. A resposta da primeira execução é gravada em `idempotency_keys` (escopada por tenant, RLS FORCE) por `(tenant, key, método, rota)`; reenvios com a mesma chave **replicam** a resposta, sem re-executar. Aplicado em: **POD** (`POST /pod`), **Tracking** (`POST /tracking/positions`), **Import** (`POST /imports/:id/confirm`) e **Otimização** (`POST /route-plans` e `/route-plans/mine`).
- **Contexto:** Sem idempotência, re-sincronizações offline (fila do app do motorista) podiam **duplicar** entregas/planos ou receber `409` no reenvio de um POD já gravado — risco #3 da análise do app Flutter.
- **Decisão:** Header `Idempotency-Key` opcional, deduplicado por um interceptor transversal. A gravação da chave é **atômica com a operação** (mesma transação): se a operação falha, a chave não é persistida (o reenvio re-executa); se sucede, o reenvio replica. O índice único é a rede de segurança contra corrida — reenvios **sequenciais** (o caso offline) são sempre deduplicados.
- **Alternativas consideradas:** Idempotência caso a caso em cada use case (repetitivo, fácil de esquecer); dedup só por chave natural (ex.: `uq_pod_delivery`) — resolve POD mas não import/otimização e ainda retorna `409` no reenvio; storage em Redis (volátil — idempotência exige durabilidade).
- **Consequências:** Reenvios viram operações seguras; base para o *sync* offline confiável. Requer que o cliente **gere e persista** uma chave por operação enfileirada. As chaves acumulam — um job de expiração/limpeza (TTL) fica como follow-up (há índice em `created_at`). Concorrência real com a mesma chave (raro) pode abortar a transação e exigir novo envio (que então replica).

## ADR-0018 — Transporte em tempo real por SSE (ticket de conexão)

- **Status:** Aceito · **Data:** 2026-07-13
- **Status da implementação:** ✅ Implementado. **SSE** (Server-Sent Events) via NestJS `@Sse`, sem dependências novas. Um `RealtimeHub` (pub/sub **in-process**, isolado por tenant) recebe eventos de `tracking.position` (a cada posição do motorista) e `optimization.job` (transições de job — a `JobEventsPort` do ADR-0007 agora publica no hub). Endpoints: `POST /realtime/ticket` (autenticado) emite um **ticket** curto; `GET /realtime/stream?ticket=…` é o stream do tenant (com `ping` de keep-alive). O web tem um `RealtimeProvider` (EventSource + reconexão com backoff) e o Tracking consome os eventos; o **polling permanece apenas como fallback** (só quando o SSE está desconectado).
- **Contexto:** O tracking (e o status de jobs) dependia de **polling**, ruim para latência/bateria e para escala. Era o risco #5 da análise do app Flutter.
- **Decisão:** **SSE**, não WebSocket — o transporte necessário é **servidor → cliente** (uma via), o SSE é HTTP puro (sem `socket.io`/deps), reconecta nativamente e é simples de consumir em web e Flutter. Como o `EventSource` do navegador **não envia cabeçalhos**, a conexão é autenticada por um **ticket curto** (obtido com o access token, passado na query) — evita expor o access token em URL/logs.
- **Alternativas consideradas:** **WebSocket/socket.io** (bidirecional, porém dependência pesada e overkill para push unidirecional); **access token na query do SSE** (vaza token em logs); **long-polling** (o que estamos substituindo).
- **Consequências:** Tracking em tempo real com fallback resiliente. **Pendências:** o hub e o store de tickets são **in-process** — multi-instância exige **Redis pub/sub** (a conexão Redis já existe) para propagar entre réplicas, sem alterar publicadores nem endpoint; enquanto isso o polling cobre o gap. Bidirecionalidade futura (ex.: comandos ao motorista) exigiria WebSocket.

---

## ADR-0019 — Mídia do Proof of Delivery em object storage (StorageService)

- **Status:** Aceito · **Data:** 2026-07-13
- **Status da implementação:** ✅ Implementado. Um `StoragePort` (`STORAGE`) com dois drivers selecionáveis por `STORAGE_DRIVER`: `local` (grava em disco e serve via `GET /api/v1/files/:scope/:tenant/:name`, para dev) e `s3` (`@aws-sdk/client-s3`, compatível com **AWS S3, Cloudflare R2 e Google Cloud Storage** pela API S3). O `SubmitPodUseCase` decodifica a data URL recebida, envia os bytes ao storage sob a chave `pod/<tenantId>/<podId>-<field>.<ext>` e persiste **apenas a URL** em `proof_of_delivery.photo`/`signature`. Um guardrail de ~4 MB por mídia continua valendo.
- **Contexto:** O POD recebia foto/assinatura como **data URL base64** e as gravava em colunas `text` do Postgres (risco #7 da análise Flutter): incha as linhas, estoura o WAL/backup, degrada as queries e não usa CDN. O app Flutter agrava o volume de mídia.
- **Decisão:** Introduzir um **StorageService** (port + adapters) e mover a mídia para **object storage**, guardando no banco só a URL. O adapter `s3` cobre S3/R2/GCS variando `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE`, sem acoplar a um provedor. **Compatibilidade temporária:** o contrato do cliente segue enviando data URL (o backend faz o offload); se o valor já for uma URL (upload direto futuro), passa direto sem reprocessar.
- **Alternativas consideradas:** **Manter base64 no Postgres** (o problema); **BYTEA** (ainda no banco, sem CDN); **upload direto do cliente via URL pré-assinada** (melhor a longo prazo, mas muda o contrato do app — fica como evolução, já acomodada pelo passthrough de URL).
- **Consequências:** Linhas do POD enxutas; mídia servível por CDN; troca de provedor por configuração. **Pendências:** o driver `local` serve por **capability URL** não-adivinhável mas **sem autenticação** (adequado a dev; produção usa `s3` + CDN, idealmente com URLs assinadas); migração dos PODs já gravados em base64 (se houver) não é retroativa; upload direto pré-assinado continua como evolução futura.

---

## ADR-0020 — Sincronização incremental offline-first (updatedSince + cursor de keyset)

- **Status:** Aceito · **Data:** 2026-07-14
- **Status da implementação:** ✅ Implementado para entregas. `GET /api/v1/deliveries/sync` devolve apenas o **delta** desde a marca d'água do cliente (`updatedSince`), **incluindo tombstones** (soft delete → `deletedAt != null`), paginado por **cursor de keyset** opaco sobre `(updated_at, id)`. Índice dedicado `idx_deliveries_tenant_sync` (sem o predicado parcial `deleted_at IS NULL`, para cobrir tombstones). Contratos genéricos `SyncParams`/`SyncResponse<T>` + helpers de kernel (`encodeCursor`/`decodeCursor`/`normalizeSync`/`buildSyncMeta`) prontos para outros recursos (fleet, pod) adotarem.
- **Contexto:** O cliente offline (Flutter/PWA) fazia **full refetch** paginado por **offset** a cada abertura — caro em rede/bateria, instável sob escrita concorrente (linhas deslizam entre páginas) e sem como saber o que foi **excluído**. Era o risco de retrabalho do offline-first da análise Flutter.
- **Decisão:** Feed incremental por **marca d'água + cursor de keyset**. A primeira página de uma rodada usa `updatedSince`; as seguintes usam o `nextCursor` opaco (precedência). A ordenação canônica `(updated_at ASC, id ASC)` torna a paginação **estável e barata** (keyset, não offset). Exclusões viram **tombstones** para o cache local remover. O cliente guarda `meta.syncedAt` como próxima marca d'água; *upserts* idempotentes por `id` toleram a sobreposição do limite `>=`.
- **Alternativas consideradas:** **Offset** (`page/pageSize`) — mantido para telas web, mas instável/O(n) para sync; **replicação estilo CouchDB `_changes`** (poderosa, porém pesada e invasiva no modelo); **hard delete** (impossível sincronizar exclusões — daí o soft delete + tombstone); **WebSocket/SSE** (complementar, para push em tempo real — ADR-0018 —, não substitui o *catch-up* em massa após ficar offline).
- **Consequências:** Sync barato e escalável; sem re-baixar a coleção; exclusões propagadas. **Pendências:** adoção do mesmo padrão em fleet/pod (base já pronta); a marca d'água depende de `updated_at` confiável (todo mutador de domínio faz `touch()`); *purge* de tombstones antigos (retenção) é roadmap; compactação/limite de payload por página já coberto pelo `limit` (máx. 500).

---

## ADR-0021 — Observabilidade de produção (OpenTelemetry + Prometheus + health)

- **Status:** Aceito · **Data:** 2026-07-14
- **Status da implementação:** ✅ Implementado. **Logs estruturados** (pino, já existentes) ganham correlação `trace_id`/`span_id`. **Métricas Prometheus** via `prom-client` (Registry dedicado) expostas em **`GET /metrics`** (fora do prefixo `/api`), com métricas padrão de processo + histograma/contador de HTTP (label de rota por **template**, baixa cardinalidade) alimentados por um `HttpMetricsInterceptor` global e observacional. **Tracing distribuído** com OpenTelemetry NodeSDK + auto-instrumentação (http/express/pg/ioredis), **opt-in** por `OTEL_ENABLED` e inicializado por efeito colateral (`observability/instrument`) antes do `AppModule`. **Health checks** `GET /api/v1/health/{live,ready}`: Postgres é dependência dura; **Redis é reportado mas não fatal** (degradável). Stack local **Prometheus + Grafana + Jaeger** com datasources/dashboard provisionados. Ver [observability.md](./observability.md).
- **Contexto:** Rumo à produção, faltavam métricas, tracing e prontidão/liveness padronizados. Sem eles, diagnosticar latência/erros em multi-tenant e escalar com segurança é inviável.
- **Decisão:** Adotar os três pilares com ferramentas idiomáticas e **sem alterar regra de negócio** (tudo transversal): pino (logs) + `prom-client`/Prometheus (métricas) + OpenTelemetry (tracing) + terminus (health). Tracing **opt-in** para não impor um coletor em dev/test; métricas sempre expostas (overhead desprezível).
- **Alternativas consideradas:** **Métricas via OTel Metrics + exporter Prometheus** (unifica no OTel, porém abre outra porta e é mais verboso — `prom-client` é mais simples e padrão para o endpoint de scrape); **APM proprietário** (Datadog/New Relic — lock-in e custo; OTel é neutro e exportável para qualquer backend); **StatsD** (push, menos rico que o modelo pull do Prometheus).
- **Consequências:** RED metrics + traces correlacionados a logs prontos para Grafana; probes para K8s. **Pendências:** `/metrics` deve ser restringido por rede em produção; **OTel Collector** (fan-out) e regras de alerta/SLO ficam para o deploy; métricas de negócio (ex.: entregas/hora) podem ser adicionadas via `MetricsService` conforme necessidade.

---

## ADR-0022 — Motor de otimização: modelo rico de restrições + perfil por veículo

- **Status:** Parcial · **Data:** 2026-07-14
- **Status da implementação:** 🟡 **Fases 1–2 de 4.** Estende o motor **reutilizando o Strategy Pattern** existente (`RouteOptimizationStrategy` + `StrategyRegistry`) e o `StrategyContext`, **sem quebrar a API pública** (todos os campos novos são opcionais).
  - **Fase 1:** (1) **demanda por parada** (`weightKg`/`volumeM3`) e **tempo de serviço por parada**; (2) **`VehicleProfile`** com defaults por tipo — **moto/bicicleta** (ágeis, baixa capacidade, evitam pedágio), **carro**, **carrinha/van**, **camião/truck** (alta capacidade, acesso urbano restrito) — com overrides; (3) **viabilidade de capacidade** (`CapacityUsage`) reportada no plano e penalizada no score; (4) **função de custo compartilhada** (`route-cost-model`, extraída da NN+2-opt) com **seam de sobretaxa por aresta/nó** (pedágio/zona de risco) — mecanismo testado, provedor na Fase 4; (5) **métricas** do solver reusando o `MetricsService` (ADR-0021).
  - **Fase 2:** **roteirização multi-veículo**. O solver de rota única foi extraído para um `RouteSolver` (reuso por rota). Um `FleetPartitioner` (heurística de **sweep** — varredura angular em torno da origem/centroide) **agrupa as paradas por proximidade** e as distribui entre a frota **respeitando capacidade** (peso/volume) e balanceando a contagem; paradas que não cabem saem em `unassignedStops`. O request aceita `vehicles[]` (mutuamente exclusivo com `vehicle`); a resposta traz `routes[]` (rota+métricas+capacidade por veículo) e o `RoutePlan` agrega métricas/score. Persistência: colunas `route_plans.capacity`/`routes`/`unassigned_stops` (JSONB nullable); demais campos nos JSONB existentes.
- **Contexto:** O motor resolvia um caminho aberto de 1 veículo só com distância + janelas + prioridade. Faltavam capacidade/peso/volume, tempo de parada, restrições por tipo de veículo, **agrupamento e distribuição por frota** e a base para pedágio/zona de risco — requisitos de uma plataforma logística de classe mundial (Uber/OnFleet/Routific).
- **Decisão:** Evoluir **por extensão, não reescrita**: enriquecer o `StrategyContext` (campos opcionais), modelar o veículo como *value object* com defaults por tipo, tratar **capacidade como viabilidade** por rota, e resolver o **VRP capacitado** por **construção (sweep) + otimização por rota** (reusando o `RouteSolver`). O clustering fica atrás de uma função de domínio pura e determinística; o solver ótimo (OR-Tools) entra na Fase 4 pela mesma port, sem mudar a API.
- **Alternativas consideradas:** **OR-Tools já** (dependência nativa pesada; primeiro o modelo de restrições + VRP heurístico, depois o solver forte); **k-means para clustering** (não respeita capacidade nativamente; o sweep capacitado é clássico de CVRP e mais adequado); **capacidade como termo de custo** (ordem-independente em rota única); **fabricar custos de pedágio/risco sem dados** (só o *seam*, provedor na Fase 4); **estender o agregado Delivery com peso/volume agora** (mudança do contexto Delivery — demanda por `deliveryIds` fica 0 até lá; via `stops` inline já funciona).
- **Consequências:** VRP capacitado multi-veículo com clustering por proximidade, tudo retrocompatível e testado. **Pendências (Fases 3–4):** reotimização automática por eventos (nova/cancelada entrega, trânsito) reusando fila + SSE; priorização dinâmica por SLA; balanceamento de carga entre veículos mais fino; provedores de pedágio/zona de risco; estratégia OR-Tools/metaheurística; demanda no agregado Delivery.

---

## ADR-0023 — Reotimização automática por eventos + priorização dinâmica por SLA

- **Status:** Aceito · **Data:** 2026-07-14
- **Status da implementação:** ✅ Implementado (Fase 3 do motor, ADR-0022). Dois pilares, **reutilizando** a fila de jobs (ADR-0007), o SSE (ADR-0018) e o `RouteSolver` (ADR-0022):
  - **Priorização dinâmica por SLA:** `slaPriorityWeight(base, windowEndMinutes)` aumenta o peso de prioridade conforme o **fim da janela** se aproxima (ou estoura), aplicado no `RouteSolver` ao montar as prioridades. Sem janela, é o peso base (retrocompatível) — uma entrega comum com prazo apertado passa à frente de uma urgente folgada.
  - **Reotimização automática:** um `DomainEventBus` **in-process** (mesmo padrão do `RealtimeHub`) propaga eventos de domínio entre módulos. Os casos de uso do Delivery publicam `delivery.created/updated/status-changed/deleted`. O `AutoReoptimizationService` (Optimizer) assina o bus, faz **debounce por tenant** (coalesce rajadas — ex.: import em massa) e dispara o `ReoptimizeActiveUseCase`, que enfileira a reotimização das entregas **ativas** (pendente/em rota) via o pipeline existente (job → SSE). É **opt-in** (`OPTIMIZER_AUTO_REOPTIMIZE`, default off). O gatilho automático estabelece a transação de tenant (mesmo padrão da fila in-process). Um endpoint **manual** `POST /route-plans/reoptimize` cobre **trânsito/eventos externos** com o mesmo caso de uso.
- **Contexto:** O plano de rota ficava obsoleto quando entregas eram criadas/canceladas/alteradas ou o trânsito mudava — exigindo reotimização manual. E a prioridade era estática, ignorando o quão perto do prazo cada entrega estava (SLA).
- **Decisão:** Introduzir um **barramento de eventos de domínio in-process** (desacopla Delivery→Optimizer sem dependência direta) + um serviço de reotimização **debounced e opt-in**, e tornar a prioridade **sensível ao SLA** no cálculo de custo. Reusar a fila/SSE/solver existentes — nada de novo pipeline. Eventos externos (trânsito) entram pelo endpoint manual (ou publicando no mesmo bus no futuro).
- **Alternativas consideradas:** **`@nestjs/event-emitter`** (dependência extra; um `Subject` RxJS espelhando o `RealtimeHub` é suficiente e consistente); **Transactional Outbox** (ADR-0006 — durável, porém sem relay/consumer ainda; o bus in-process é o passo pragmático, evoluível para outbox/Redis pub/sub); **reotimização síncrona no request da entrega** (acopla latência e falha do request à otimização; o debounce assíncrono é melhor); **priorização por ML** (Fase futura — a função por SLA é determinística e explicável).
- **Consequências:** Rota se mantém atualizada automaticamente (quando ligada) e prioriza por urgência real de prazo. **Pendências:** o bus é in-process (multi-instância exige **Redis pub/sub**, igual ao SSE); a reotimização automática reotimiza **todas** as ativas do tenant (não há ainda o conceito de "rota corrente" por veículo/motorista — granularidade fina é evolução); dedup/So idempotência entre reoptimizações concorrentes; provedores de trânsito publicando no bus (Fase 4).

---

## ADR-0024 — Estratégia metaheurística (VND) + sobretaxas de pedágio/zona de risco

- **Status:** Aceito · **Data:** 2026-07-14
- **Status da implementação:** ✅ Implementado (Fase 4 do motor). Dois itens, ambos **pela mesma port/seam** já existentes:
  - **Metaheurística `or-opt-2opt`:** buscas locais extraídas para `domain/local-search` (`nearestNeighbor`, `twoOptImprove`, `orOptImprove`) e reusadas pela NN+2-opt e por uma nova estratégia **VND** (Variable Neighborhood Descent) que alterna **2-opt** e **Or-opt** até nenhuma vizinhança melhorar (com orçamento de tempo). Determinística e sem dependências; **nunca pior** que a NN+2-opt. Entra na `OPTIMIZATION_STRATEGIES` (multi-provider); selecionável por `strategy: 'or-opt-2opt'`.
  - **Sobretaxas (pedágio/zona de risco):** `CostAugmentationPort` preenche o *seam* `edgeSurcharge`/`nodeSurcharge` do `StrategyContext`/`route-cost-model` (criado na ADR-0022). O `ConfigurableCostAugmentation` aplica **zonas de risco** (círculos lat/long/raio/penalidade, de `OPTIMIZER_RISK_ZONES`) como sobretaxa de nó; sem zonas, é **no-op** (retrocompatível). O `RouteSolver` consulta a port e injeta as sobretaxas no contexto — as estratégias passam a **evitar** trechos/paradas penalizados sem qualquer alteração nelas.
- **Contexto:** Faltava (a) um solver mais forte que o NN+2-opt e (b) fazer o motor **considerar pedágios e zonas de risco** — os requisitos finais da evolução (ADR-0022, Fase 4).
- **Decisão:** Entregar uma **metaheurística real (VND)** — determinística, testável e sem dependências nativas — em vez de acoplar o **OR-Tools nativo** agora (binding C++ frágil/instável de instalar e verificar). Como é apenas outra implementação da `RouteOptimizationStrategy`, um **adaptador OR-Tools é drop-in** no futuro, sem tocar API/domínio. Para pedágio/risco, ativar o *seam* de custo já projetado com uma **port de aumento de custo** e um provedor configurável de zonas de risco; o pedágio real depende de dados de grafo de um provedor de mapas (port aberta, no-op hoje) e a preferência `avoidTolls` do veículo já é propagada.
- **Alternativas consideradas:** **OR-Tools nativo já** (dependência C++ pesada, instalação/verificação frágil no ambiente; adiado, com path drop-in pela port); **Simulated Annealing** (bom, mas estocástico → testes instáveis; o VND determinístico é mais adequado a testes/reprodutibilidade); **custos de pedágio fixos fabricados** (enganoso sem dados de rede — mantido como port no-op honesta).
- **Consequências:** Rotas de melhor qualidade sob demanda (`or-opt-2opt`) e um mecanismo real e testado para **penalizar zonas de risco** (e pedágio quando houver provedor). **Pendências:** adaptador OR-Tools nativo; provedor de **dados de pedágio** (grafo/rede) para preencher `edgeSurcharge`; fonte de zonas de risco por tenant (hoje via env global); *tuning* de pesos por tenant.

---

## ADR-0025 — Navix Intelligence: primeira camada (heurísticas atrás de ports, ML-ready)

- **Status:** Aceito · **Data:** 2026-07-14
- **Status da implementação:** ✅ Implementado. Módulo `intelligence` (Clean Architecture) expondo **`POST /api/v1/intelligence/route-forecast`**, que retorna um relatório com: **cronograma** (ETA por parada + previsão de conclusão), **atrasos** (identificação antecipada + severidade + mitigação), **combustível** (consumo estimado + recomendação preventiva de abastecimento), **melhor horário de saída** (varredura minimizando atrasos), **contexto de trânsito** e **perfil do motorista**. Cada capacidade é um **serviço de domínio puro** (`route-scheduler`, `delay-risk`, `fuel-advisor`, `departure-planner`) e as duas fontes "inteligentes" são **ports**: `TrafficModelPort` (heurística por hora/dia — `TimeContextTrafficModel`) e `DriverProfileSourcePort` (perfil aprendido; adaptador padrão sem histórico + `learnDriverProfile` estatístico). Reusa `haversineKm` (kernel), `VehicleType` e as janelas do Delivery.
- **Contexto:** Faltava a camada de IA/predição da plataforma (a visão "Navix Intelligence"). O requisito-chave: **desacoplada e reutilizável**, preparada para **evoluir para ML/LLM** sem reescrever consumidores.
- **Decisão:** Entregar a **primeira camada como heurísticas determinísticas atrás de ports** — os mesmos *seams* por onde entrarão modelos de ML depois (previsão de trânsito por região/hora; perfil de motorista por ML; ETA por modelo). Serviços de domínio puros e testáveis; nenhuma dependência de framework de ML agora. A personalização por motorista é o `DriverProfile` (aprendido por estatística hoje, por modelo amanhã) consumido pelo scheduler.
- **Alternativas consideradas:** **Integrar um modelo de ML/serviço externo já** (sem dados históricos suficientes e sem pipeline de features/treino — prematuro; a port deixa isso plugável); **acoplar a inteligência dentro do Optimizer** (viola coesão — predição ≠ otimização; mantidos separados, o Optimizer resolve *ordem*, a Intelligence prevê *tempo/risco/recursos*); **LLM para recomendações** (útil para explicações em linguagem natural — evolução futura sobre os mesmos dados estruturados).
- **Consequências:** Base coesa e testada para inteligência logística, com contratos estáveis e *seams* de ML explícitos. **Pendências:** adaptador de `DriverProfileSourcePort` sobre `driver_positions`/POD (dados reais de aprendizado); modelo de trânsito por dados históricos/região; ETA por modelo preditivo; pipeline de features/treino; explicações via LLM; persistência/telemetria dos relatórios.

---

## ADR-0026 — Modo Economia (tempo · combustível · pedágio · CO₂)

- **Status:** Aceito · **Data:** 2026-07-14
- **Status da implementação:** ✅ Implementado (Fase A da camada de experiência do motorista). `OptimizeRouteRequest.economyMode ∈ {time,fuel,tolls,co2}` mapeia um **preset de `OptimizationWeights`** sobre a função de custo compartilhada (sem algoritmo novo): `time` valoriza janelas; `fuel`/`co2` minimizam distância; `tolls` amplifica a sobretaxa do `CostAugmentationPort` (ADR-0024). A resposta ganha `metrics.estimatedCo2Kg` (consumo por tipo × fator de emissão) e `params.economyMode`. No **web**: `EconomyModeSelector` (radiogroup acessível, tokens do DS, i18n PT-BR/PT-PT/EN/ES) no Otimizador + card de CO₂ no plano. Tudo aditivo/retrocompatível.
- **Contexto:** Primeiro recurso da "camada de experiência do motorista" (proposta aprovada). O motorista/operador quer escolher **o objetivo** da otimização, com o trade-off explícito.
- **Decisão:** Entregar o Modo Economia como **preset de pesos sobre o motor que já existe**, não um novo algoritmo — máximo reuso, risco zero de regressão, transparente. CO₂ é derivado do consumo (reuso da tabela por tipo de veículo). A **diferenciação fina** entre `time` (duração real ≠ distância) e `tolls` (custo de pedágio por trecho) depende de um **provedor de mapas real** (rotas/pedágio), sequenciado como o próximo PR da Fase A (exige credencial `MAPBOX_TOKEN` e refactor síncrono→assíncrono do provedor de distância — isolado para revisão segura).
- **Alternativas consideradas:** **Algoritmos separados por modo** (duplicação desnecessária — o mesmo motor com pesos resolve); **integrar o provedor de mapas no mesmo PR** (acopla credenciais + refactor async ao recurso — preferimos isolar); **CO₂ por API externa** (desnecessário nesta camada; a estimativa por consumo é suficiente e explicável).
- **Consequências:** Objetivo de otimização selecionável e um indicador de sustentabilidade (CO₂), em compatibilidade total com o DS. **Pendências:** provedor de mapas real para tempo/pedágio fiéis; navegação contextual (2º recurso da Fase A); *tuning* de pesos por tenant.

---

## ADR-0027 — Provedor de mapas/roteamento (Mapbox) com fallback Haversine

- **Status:** Aceito · **Data:** 2026-07-15
- **Status da implementação:** ✅ Implementado. Novo `RoutingProviderPort` que devolve a **matriz de distância (km) e duração (min)** entre os pontos — assíncrono. `HaversineRoutingProvider` (default) deriva a duração da velocidade do veículo; `MapboxRoutingProvider` usa a **Mapbox Matrix API** (`directions-matrix/v1/mapbox/driving`, distância+duração reais, com trânsito), selecionável por `MAPS_PROVIDER=mapbox` + `MAPBOX_TOKEN`. **Resiliente**: sem token, acima de 25 coordenadas, timeout (4s) ou qualquer erro externo → **degrada para Haversine**, nunca derruba a otimização (mesmo princípio do Redis/tracing/storage). O `RouteSolver` foi refatorado para **assíncrono** e consome a port; `OptimizeRouteUseCase` (single/fleet) aguarda. `OptimizerService.estimate` mantém o `DistanceProviderPort` síncrono.
- **Contexto:** O Modo Economia (ADR-0026) por **tempo** e o cronograma dependem de **duração real de trânsito** (≠ distância/velocidade). Sem um provedor de mapas, `time`/`fuel`/`co2` colapsam em "minimizar distância". O usuário aprovou integrar mapas já.
- **Decisão:** Introduzir a port de roteamento com **matriz** (não par-a-par — encaixa na API do Mapbox e é eficiente), um adaptador real **opt-in** e **fallback geométrico** sempre presente. A credencial `MAPBOX_TOKEN` é fornecida pelo operador no ambiente (segredo) — o código nunca a embute. A refatoração síncrono→assíncrona ficou **isolada neste PR** para revisão segura do motor já validado.
- **Alternativas consideradas:** **Directions por par (n²)** (estoura rate limit/custo; a Matrix API resolve em uma chamada, até 25 pts); **OSRM self-hosted** (sem credencial, porém exige operar o serviço — a port aceita esse adaptador no futuro); **manter só Haversine** (não entrega tempo/pedágio fiéis — o requisito); **credencial embutida** (proibido; vem do ambiente).
- **Consequências:** Distância e **tempo reais** quando `mapbox` está ligado, com degradação graciosa; base para tempo/pedágio fiéis no Modo Economia. **Pendências:** chunking para rotas > 25 paradas; **custo de pedágio por trecho** (Directions com dados de pedágio) para preencher o `edgeSurcharge`; usar o provedor também no cronograma da Intelligence (ADR-0025); cache/rate-limit dedicados.

---

## ADR-0028 — Navegação contextual (instruções de acesso ao destino)

- **Status:** Aceito · **Data:** 2026-07-15
- **Status da implementação:** ✅ Implementado (2º recurso da Fase A, **fecha a Fase A**). O `route-forecast` (ADR-0025) passa a derivar **instruções de acesso** por parada: um `AccessInstructionsPort` classifica as observações livres (`accessNotes`, ex.: `delivery.notes`) em tipos — **entrada, doca, interfone, código, portaria, nota** — via `classifyAccessNotes` (heurística por palavras-chave, pura e testada). Cada `ScheduledStopView` ganha `access[]` quando há observações. No **web**: componente reutilizável `AccessInstructionList` (ícone + rótulo por tipo, tokens do DS, i18n PT-BR/PT-PT/EN/ES, a11y) + cliente `intelligenceApi.routeForecast`.
- **Contexto:** "Chegou ao destino" não basta na última milha: o motorista precisa saber **como acessar** (porta de serviço, doca, interfone, código, deixar na portaria). A informação existe solta nas observações da entrega — faltava estruturá-la.
- **Decisão:** Extrair as instruções por um **port** (ML-ready), com um classificador heurístico determinístico agora e NLP/LLM depois, **sem tocar o caso de uso**. A UI é um componente de domínio reutilizável, plugável na rota do motorista/previsão.
- **Alternativas consideradas:** **Campo estruturado por entrega** (exigiria migração do Delivery + recoleta de dados; a extração das observações aproveita o que já existe e evolui p/ estruturado depois); **LLM já** (sem pipeline/custo justificados nesta camada — a port deixa plugável); **texto cru sem classificação** (pior UX — o tipo permite ícone/priorização).
- **Consequências:** Navegação de acesso premium a partir de dados existentes, i18n e acessível. **Pendências:** campo de acesso estruturado no agregado Delivery; NLP/LLM no classificador; feedback do motorista realimentando a base (o que deu certo na visita); integração numa página de previsão dedicada do motorista.

---

## ADR-0029 — Previsão inteligente de estacionamento (Fase B)

- **Status:** Aceito · **Data:** 2026-07-15
- **Status da implementação:** ✅ Implementado (1º recurso da **Fase B**). O `route-forecast` (ADR-0025) passa a anexar uma **previsão de estacionamento** por parada: um `ParkingPredictorPort` estima **dificuldade** (fácil/moderado/difícil), **confiança** e **minutos a pé** até a porta no horário previsto de chegada. O adaptador heurístico `HeuristicParkingPredictor` **reutiliza o `TrafficModelPort`** (ADR-0025) como proxy de congestionamento local — sem nova dependência de dados. Cada `ScheduledStopView` ganha `parking?`. No **web**: componente reutilizável `ParkingBadge` (ícone + dificuldade com tom do DS + caminhada, i18n PT-BR/PT-PT/EN/ES, a11y).
- **Contexto:** Na última milha, o tempo real de entrega inclui **encontrar vaga e caminhar** até a porta — invisível no ETA puro. Antecipar a dificuldade permite ao motorista se planejar (janela, veículo, aproximação) e melhora a precisão percebida do cronograma.
- **Decisão:** Expor a previsão por um **port** ML-ready, com heurística determinística agora (proxy de trânsito) e modelo dedicado depois (histórico de permanência/vaga, tipo de via, horário), **sem tocar consumidores**. Reutilizar o sinal de trânsito já existente em vez de introduzir fonte nova.
- **Alternativas consideradas:** **Modelo dedicado já** (sem dados de estacionamento coletados ainda — a port deixa plugável); **fonte externa de vagas** (custo/cobertura não justificados nesta camada; entra atrás da port depois); **ignorar estacionamento** (subestima a última milha — pior UX/precisão).
- **Consequências:** Sinal premium de última milha a partir de dados existentes, i18n e acessível. **Pendências:** modelo dedicado com histórico de permanência/vaga por local e horário; realimentação do motorista (dificuldade real observada); sinais externos de disponibilidade de vaga; integração na página de previsão dedicada do motorista.

---

## ADR-0030 — Organização otimizada da carga (Fase B)

- **Status:** Aceito · **Data:** 2026-07-15
- **Status da implementação:** ✅ Implementado (2º recurso da **Fase B**, **fecha a Fase B**). Novo endpoint `POST /intelligence/load-plan`: dado um conjunto de itens com ordem de entrega e peso/volume/fragilidade, o `LoadPlannerPort` devolve um **plano de carregamento**. A heurística `planLoad` aplica **LIFO** — o que é entregue primeiro é carregado por último (fica junto à porta / por cima), minimizando remanejo — e calcula **zonas de estiva** (porta/meio/fundo), **ocupação** de peso/volume e **avisos** (excesso de capacidade, frágil sob carga). A capacidade vem explícita (`capacityKg`/`capacityVolumeM3`) ou é derivada do tipo de veículo. No **web**: componente reutilizável `LoadPlanList` (ordem, zona, frágil, ocupação e avisos; DS + i18n PT-BR/PT-PT/EN/ES + a11y).
- **Contexto:** Depois de definir a rota, o motorista ainda perde tempo (e arrisca avarias) organizando a carga por instinto. A ordem de entrega já determina a estiva ótima — faltava traduzir isso num plano claro, com ocupação e alertas.
- **Decisão:** Expor o plano por um **port** ML-ready — heurística LIFO determinística agora, **planejador 3D (bin packing)** ou modelo aprendido depois, **sem tocar consumidores**. Endpoint dedicado (separado do route-forecast) por ser uma preocupação física distinta do cronograma.
- **Alternativas consideradas:** **Dobrar no route-forecast** (mistura estiva com cronograma; o endpoint dedicado mantém coesão e evolui isolado); **bin packing 3D já** (complexidade/tempo não justificados nesta camada — a port deixa plugável); **reusar o `VehicleProfile` do otimizador** para capacidade (violaria a fronteira entre módulos de negócio — mantida uma tabela local de capacidade por tipo, com **pendência** de consolidar os defaults de capacidade no `shared/kernel` para eliminar a duplicação sem acoplar os módulos).
- **Consequências:** Preparação de carga premium, determinística, i18n e acessível, a partir da ordem de entrega. **Pendências:** consolidar capacidade por tipo de veículo no `shared/kernel` (unificar com `VehicleProfile`); planejador 3D/bin packing (dimensões, empilhamento, restrições de estiva); ligar o plano à rota otimizada e ao POD; realimentação do motorista (avarias/remanejo reais).

---

## ADR-0031 — Inteligência coletiva por tenant (Fase C)

- **Status:** Aceito · **Data:** 2026-07-15
- **Status da implementação:** ✅ Implementado (1º recurso da **Fase C**). O conhecimento que a frota adquire em campo passa a ser compartilhado dentro do tenant. Dois endpoints: `POST /intelligence/observations` (o motorista relata **estacionamento** real, **tempo de atendimento** ou **dica de acesso** confirmada) e `GET /intelligence/insights?latitude&longitude` (devolve o insight agregado). As observações são persistidas na tabela `collective_observations` (RLS FORCE + policy por tenant, como todo dado de negócio) e atribuídas a uma **célula de localização** (`locationCell`, arredondamento a 3 casas ≈ 110 m). A agregação é uma função de domínio pura (`aggregateInsight`): **moda** da dificuldade de estacionamento (desempate pela mais severa), **mediana** do tempo de atendimento e **dedupe** das dicas por frequência, tudo sujeito a uma **amostra mínima** (`MIN_SAMPLE`) antes de expor qualquer agregado. No **web**: componente reutilizável `CollectiveInsightCard` (estacionamento/atendimento/dicas + tamanho da amostra; DS + i18n PT-BR/PT-PT/EN/ES + a11y).
- **Contexto:** Cada motorista redescobre sozinho as particularidades de cada endereço (onde estacionar, quanto demora, como acessar). Esse conhecimento se perde. As ADRs 0028/0029 já apontavam a "realimentação do motorista" como pendência — a inteligência coletiva é o laço que fecha isso.
- **Decisão:** Persistir observações por tenant atrás de um **port** (`CollectiveInsightsPort` — armazenamento) e manter a **agregação no domínio** (pura, testável, independente do store). Escopo **por tenant** (decisão do produto) com RLS, reusando o padrão de persistência existente (entidade ORM + `scopedRepository` + migração com policy). **Privacidade:** `driverId` guardado para dedupe/anti-abuso e nunca exposto; agregados só aparecem acima da amostra mínima, evitando identificar um relato individual.
- **Alternativas consideradas:** **Store em memória** (não sobrevive a restart nem a múltiplas instâncias — inviável para "coletivo"); **agregação no SQL** (mais rápida, porém acopla a lógica ao banco e dificulta o teste/evolução — a agregação pura pode virar modelo depois); **sem célula, por coordenada exata** (não agrupa relatos próximos e expõe posição — a célula agrega e anonimiza); **cross-tenant/global** (rejeitado por privacidade e por decisão de produto: o coletivo é da frota).
- **Consequências:** A frota fica mais inteligente a cada entrega; o laço de realimentação das ADRs 0028/0029 passa a existir. **Pendências:** realimentar as próprias previsões (um `CommunityAwareParkingPredictor`/`AccessInstructions` que consulte o insight); ponderar por recência/reputação do motorista; expurgo/retention das observações; agregação incremental/materializada para escala; app do motorista (mobile) publicando observações automaticamente ao concluir a parada.

---

## ADR-0032 — Assistente por voz do motorista (Fase C)

- **Status:** Aceito · **Data:** 2026-07-15
- **Status da implementação:** ✅ Implementado (2º recurso da **Fase C**, **fecha a Fase C e os 6 recursos da experiência do motorista**). Novo endpoint `POST /intelligence/voice-command`: recebe a **transcrição** de um comando falado (produzida pelo STT do navegador) e devolve a **intenção** classificada (`next_stop`/`route_summary`/`remaining`/`mark_delivered`/`report_parking`/`help`/`unknown`), confiança e _slots_ (ex.: dificuldade de estacionamento). A classificação é uma função de domínio pura (`interpretVoiceCommand`) por palavras-chave multilíngue (PT/EN/ES, robusta a acentos), atrás do `VoiceCommandInterpreterPort`. O reconhecimento (STT) e a síntese de fala (TTS) ficam no **navegador** (Web Speech API); o backend só faz NLU. No **web**: componente reutilizável `VoiceAssistantButton` (microfone, estados ouvindo/resposta, fala a resposta, _fallback_ elegante quando o navegador não suporta) + `useLocale` para idioma; o host reage à intenção via `onIntent`. A **cópia falada é montada no cliente** (i18n), mantendo o backend livre de i18n.
- **Contexto:** Dirigindo, o motorista não pode operar a tela. Um comando de voz ("qual a próxima parada?", "marcar entregue") mantém as mãos no volante e os olhos na via — segurança e fluidez na última milha.
- **Decisão:** Manter **STT/TTS no navegador** (grátis, sem streaming de áudio para o servidor, privacidade) e colocar a **classificação de intenção atrás de uma port** (heurística agora, NLU/LLM depois) — o mesmo padrão ML-ready das demais camadas. O backend devolve intenção estruturada, não texto; a fala é localizada no cliente. O assistente **não executa ações** — expõe a intenção; o host decide o que fazer, evitando efeitos colaterais acoplados.
- **Alternativas consideradas:** **NLU/áudio no servidor** (custo/latência/privacidade de enviar áudio; a Web Speech API resolve no cliente — a port deixa o upgrade para NLU plugável); **classificar no próprio web** (perderia o seam ML e a reutilização mobile; a intenção é conhecimento de domínio); **backend devolver a frase pronta** (exigiria i18n no backend — preferiu-se intenção + i18n no cliente); **assistente que executa ações** (efeitos colaterais acoplados e arriscados por voz — preferiu-se intenção + host no controle).
- **Consequências:** Operação _hands-free_ premium, multilíngue e acessível, com _fallback_ quando não há suporte. Seam pronto para NLU/LLM. **Pendências:** ligar `onIntent` às ações reais (abrir próxima parada, registrar observação coletiva, marcar entregue via POD); diálogo com contexto/confirmação por voz; wake-word; NLU/LLM com entidades (endereço, cliente); paridade no app mobile (Flutter) com STT/TTS nativos.

---

## ADR-0033 — Montagem da experiência do motorista na tela (integração A)

- **Status:** Aceito · **Data:** 2026-07-16
- **Status da implementação:** ✅ Implementado (1ª integração da sequência A→E). Os 6 recursos do motorista (ADR-0026–0032) estavam construídos e testados isoladamente, mas **não renderizados** em nenhuma página. A página `driver` passa a montá-los: `VoiceAssistantButton` no cabeçalho (com `onIntent` inicial `mark_delivered`→concluir parada) e `DriverStopIntelligence` na coluna da parada atual, reunindo **estacionamento** e **acesso** (do `route-forecast`), **inteligência coletiva** (do `insights` pela coordenada da próxima parada) e **organização da carga** (do `load-plan`). As três consultas (`react-query`) derivam do **plano de rota** já carregado (as paradas trazem `latitude/longitude`, `sequence` e demanda).
- **Contexto:** Entregar valor exige que o trabalho das Fases A–C apareça na tela do motorista. Sem a montagem, tudo ficava no backend + testes.
- **Decisão:** Separar **apresentação** de **busca de dados**: `DriverStopIntelligence` é puramente apresentacional (recebe `parking`/`access`/`insight`/`loadPlan` por props, testável com RTL sem `react-query`), enquanto a página faz as consultas e o _join_ por `deliveryId`. Reutilizar os componentes já existentes (`ParkingBadge`, `AccessInstructionList`, `CollectiveInsightCard`, `LoadPlanList`, `VoiceAssistantButton`) sem alterá-los.
- **Alternativas consideradas:** **Componente com data-fetching embutido** (dificultaria o teste e acoplaria à camada de dados — preferiu-se apresentacional + consultas na página); **nova rota dedicada** (a página `driver` já é o hub natural do motorista); **derivar a previsão de outra fonte** (o plano de rota já tem as coordenadas e a sequência — evita nova origem de dados).
- **Consequências:** A experiência premium do motorista fica visível e coesa, reusando componentes e o Design System. Prepara o terreno para as integrações B (realimentar previsões com a coletiva), C (ações reais do assistente) e D (captura automática de observações). **Pendências:** ver ADR-0031/0032 (realimentação e ações); acesso depende de `accessNotes` chegarem ao plano; POD/observação automáticos ao concluir parada.

---

## ADR-0034 — Estacionamento ciente da comunidade (integração B)

- **Status:** Aceito · **Data:** 2026-07-16
- **Status da implementação:** ✅ Implementado (2ª integração da sequência A→E). A previsão de estacionamento do `route-forecast` passa a **realimentar-se da inteligência coletiva** (ADR-0031). A `ParkingPredictorPort` foi tornada **assíncrona e escopada por `tenantId`** (mesmo movimento do `RoutingProviderPort` na ADR-0027). O novo `CommunityAwareParkingPredictor` parte da heurística de trânsito (ADR-0029) e a corrige com o que a frota observou na **célula** do local: `blendParking` (função pura) mistura a dificuldade heurística com a da comunidade **na proporção da confiança desta** e eleva a confiança final; sem observações, degrada para a heurística intacta. O `forecast-route.use-case` passou a compor as previsões por parada em paralelo (`Promise.all`).
- **Contexto:** As ADRs 0029/0031 deixaram explícito o laço a fechar: as observações reais dos motoristas deveriam corrigir a previsão. Um proxy de trânsito erra; o histórico da frota no ponto exato é sinal de ouro.
- **Decisão:** Fechar o laço por um **novo adaptador** da mesma port (não um novo endpoint) — o consumidor (`forecast`) não muda de forma. Manter a **mescla no domínio** (`blendParking`, pura e testável), independente do armazenamento. Tornar a port assíncrona/por tenant para permitir a consulta ao store coletivo com RLS. Preferir **realimentar** (blend) a **substituir** — a heurística cobre locais sem histórico.
- **Alternativas consideradas:** **Substituir a heurística pela comunidade** (deixaria locais novos sem previsão — o blend cobre a partida a frio); **enriquecer no use-case** em vez de num adaptador (misturaria orquestração com regra e vazaria a coletiva para fora da port); **manter a port síncrona** e pré-carregar observações (acoplaria o use-case ao store e à paginação — a port assíncrona é mais limpa); **agregar no SQL** (perde a função de mescla testável e a evolução para modelo).
- **Consequências:** A frota fica mais precisa a cada observação, sem novo endpoint nem mudança de contrato. Custo: uma consulta ao store por parada na previsão (mitigável com cache/materialização — pendência). **Pendências:** aplicar o mesmo padrão ao **acesso** (dicas da comunidade enriquecendo `AccessInstructionsPort`) e ao **tempo de atendimento** (`typicalServiceMinutes` no `route-scheduler`); cache/materialização por célula para escala; ponderar por recência/reputação.

---

## ADR-0035 — Ações do assistente de voz + captura automática (integrações C+D)

- **Status:** Aceito · **Data:** 2026-07-16
- **Status da implementação:** ✅ Implementado (3ª e 4ª integrações da sequência A→E, **web-only**). **C:** o `onIntent` do `VoiceAssistantButton` na página do motorista deixa de ser um esboço e passa a executar **ações reais** — `mark_delivered` conclui a parada (abre o POD); `report_parking` registra uma observação de estacionamento (`recordObservation`) no local da próxima parada, com a dificuldade extraída da fala (`reportedParkingDifficulty`, default `hard`); `next_stop`/`remaining`/`route_summary` respondem com **dados reais** (ETA, paradas restantes, score) via _toast_. **D:** ao concluir uma parada (após o POD), o **tempo de atendimento** é capturado automaticamente — `dwellMinutes` mede o intervalo desde que a parada ficou ativa (um `ref` reiniciado por `useEffect`) e vira uma observação `service_time` no local. Ambas as capturas invalidam o insight coletivo da parada. Helpers puros (`dwellMinutes`, `reportedParkingDifficulty`) em `lib/driver/field-observations` são testados isoladamente.
- **Contexto:** As ADRs 0031/0032 deixaram como pendência ligar o assistente às ações e alimentar a coletiva sem fricção. O motorista dirigindo não digita; o valor da inteligência coletiva depende de **haver** observações.
- **Decisão:** Wiring **no cliente**, reusando os endpoints existentes (`recordObservation`), sem novo backend. Medir o dwell **no cliente** (a página já conhece o ciclo de vida da parada) em vez de inferi-lo no servidor a partir de POD/tracking (mais simples e sem nova origem de dados). Extrair a lógica pura para helpers testáveis; manter a orquestração (efeitos, toasts) na página.
- **Alternativas consideradas:** **Capturar o dwell no backend** (exigiria correlacionar chegada×POD via tracking — mais complexo e sem ganho nesta fase); **assistente que confirma antes de agir** (bom para ações destrutivas; aqui as ações são reversíveis/seguras — deixado como evolução); **publicar a observação por evento de domínio** (a captura no cliente é suficiente e evita acoplar POD à coletiva; a versão por evento fica para o mobile).
- **Consequências:** A coletiva passa a se alimentar sozinha a cada entrega e o assistente vira útil de fato, fechando o ciclo _observar → agregar → prever_ (ADR-0031→0034→0035). **Pendências:** confirmação por voz para ações sensíveis; capturar dwell também no app mobile; medir chegada real (geofence) em vez do início da parada na tela; publicar observações por evento de domínio no backend para fontes não-web.

---

## Template

```markdown
## ADR-XXXX — <título curto>

- **Status:** Proposto | Planejado | Parcial | Aceito | Rejeitado | Substituído por ADR-YYYY | Depreciado
- **Data:** AAAA-MM-DD
- **Status da implementação:** ✅/🟡/⬜ — o que existe hoje no código, com precisão.
- **Contexto:** Qual problema/força motriz levou a esta decisão?
- **Decisão:** O que foi decidido, de forma direta.
- **Alternativas consideradas:** Opções avaliadas e por que foram preteridas.
- **Consequências:** Impactos positivos e negativos; trade-offs; o que passa a ser exigido.
```

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial + ADRs 0000–0004 |
| 2026-07-05 | 0.2 | CTO | Revisão: ADRs 0005–0011 (ORM, outbox, otimizador, UUIDv7, série temporal, envelope encryption, CQRS) |
| 2026-07-06 | 0.3 | Engenharia | Hardening: ADRs 0012–0014 (RLS forçada, RS256, rate limiting) |
| 2026-07-12 | 0.4 | Arquitetura | Alinhamento doc↔código: coluna "Status da implementação" por ADR; status ajustados para `Parcial`/`Planejado` onde ainda não implementado (0002, 0006, 0007, 0009, 0010, 0011, 0014) |
| 2026-07-12 | 0.5 | Engenharia | Redis: conexão compartilhada resiliente + rate limiting em Redis com fallback (ADR-0014 → Aceito); abstrações de cache/fila prontas (ADR-0002 atualizado) |
| 2026-07-13 | 0.6 | Arquitetura | ADR-0015: separação Web (cookie) × Mobile (bearer) por endpoints dedicados; header X-Auth-Mode eliminado |
| 2026-07-13 | 0.7 | Arquitetura | ADR-0016: login sem tenantId — tenant resolvido por e-mail (ou slug da empresa); e-mail global único + tenants.slug |
| 2026-07-13 | 0.8 | Arquitetura | ADR-0017 (Idempotency-Key), ADR-0018 (tempo real por SSE) e ADR-0019 (mídia do POD em object storage) |
| 2026-07-14 | 0.9 | Arquitetura | ADR-0020: sincronização incremental offline-first (updatedSince + cursor de keyset, tombstones) para entregas |
| 2026-07-14 | 1.0 | Arquitetura | ADR-0021: observabilidade de produção (OpenTelemetry, métricas Prometheus em /metrics, health checks, stack Grafana/Jaeger) |
| 2026-07-14 | 1.1 | Arquitetura | ADR-0022 (Fase 1): motor de otimização com demanda/capacidade, tempo de serviço por parada, VehicleProfile por tipo e custo compartilhado (seam pedágio/risco) |
| 2026-07-14 | 1.2 | Arquitetura | ADR-0022 (Fase 2): roteirização multi-veículo — RouteSolver reutilizável + FleetPartitioner (sweep capacitado); request `vehicles[]`, resposta `routes[]` + não atribuídas |
| 2026-07-14 | 1.3 | Arquitetura | ADR-0023 (Fase 3): reotimização automática por eventos (DomainEventBus + debounce, opt-in) + endpoint manual; priorização dinâmica por SLA |
| 2026-07-14 | 1.4 | Arquitetura | ADR-0024 (Fase 4): estratégia metaheurística `or-opt-2opt` (VND) + `CostAugmentationPort` (zonas de risco no seam de custo); ADR-0022 → Aceito |
| 2026-07-14 | 1.5 | AI Eng. | ADR-0025: Navix Intelligence (1ª camada) — route-forecast com cronograma/ETA, atrasos, combustível, melhor saída; heurísticas atrás de ports prontas para ML/LLM |
| 2026-07-15 | 1.6 | Design+Arch | ADR-0026: Modo Economia (tempo/combustível/pedágio/CO₂) — preset de pesos + CO₂ + seletor no web (DS/i18n/a11y); Fase A da experiência do motorista |
| 2026-07-15 | 1.7 | Arquitetura | ADR-0027: RoutingProviderPort + adaptador Mapbox Matrix API (fallback Haversine); solver refatorado para async |
| 2026-07-15 | 1.8 | Design+Arch | ADR-0028: Navegação contextual — AccessInstructionsPort + access[] no route-forecast + AccessInstructionList no web; encerra a Fase A |
| 2026-07-15 | 1.9 | Design+Arch | ADR-0029: Previsão inteligente de estacionamento — ParkingPredictorPort (reusa TrafficModelPort) + parking por parada no route-forecast + ParkingBadge no web; abre a Fase B |
| 2026-07-15 | 2.0 | Design+Arch | ADR-0030: Organização otimizada da carga — POST /intelligence/load-plan (LoadPlannerPort LIFO + zonas/ocupação/avisos) + LoadPlanList no web; encerra a Fase B |
| 2026-07-15 | 2.1 | Design+Arch | ADR-0031: Inteligência coletiva por tenant — observações de campo (RLS) agregadas por célula atrás do CollectiveInsightsPort + CollectiveInsightCard no web; abre a Fase C |
| 2026-07-15 | 2.2 | Design+Arch | ADR-0032: Assistente por voz — POST /intelligence/voice-command (VoiceCommandInterpreterPort, heurística de intenção PT/EN/ES) + VoiceAssistantButton (Web Speech API) no web; encerra a Fase C e os 6 recursos do motorista |
| 2026-07-16 | 2.3 | Design+Arch | ADR-0033: Montagem da experiência do motorista na página (VoiceAssistantButton + DriverStopIntelligence, apresentacional + consultas derivadas do plano); abre as integrações A→E |
| 2026-07-16 | 2.4 | Arquitetura | ADR-0034: Estacionamento ciente da comunidade — ParkingPredictorPort assíncrona/por tenant + CommunityAwareParkingPredictor realimenta a previsão (integração B) |
| 2026-07-16 | 2.5 | Design+Arch | ADR-0035: Ações do assistente de voz + captura automática do tempo de atendimento (dwell) realimentando a coletiva (integrações C+D) |
