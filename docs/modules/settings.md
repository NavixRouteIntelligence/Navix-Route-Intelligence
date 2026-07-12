# Configurações (Settings) — superfície transversal de preferências e administração

> **Status:** Etapa 1 completa · Etapa 2 (Perfil) implementada · **Atualizado:** 2026-07-12
> A **Etapa 1** (fundação `user-settings` + shell `/settings`) e o **Perfil** da
> Etapa 2 estão implementados (ver §10). Alterar e-mail, sessões/dispositivos,
> Empresa, Notificações e Integrações seguem como desenho — placeholders "Em breve".

A área de **Configurações** reúne, em uma única superfície de navegação, nove domínios: **Perfil, Empresa, Preferências, Idioma, Tema, Segurança, Biometria, Notificações e Integrações**. "Configurações" **não é um bounded context** — é uma *superfície de agregação* (view) sobre vários contextos existentes e novos. Cada aba é servida pelo módulo dono do respectivo contexto, preservando as fronteiras de DDD (ver `docs/architecture.md` §4) e evitando um "módulo Deus".

O estado atual do código já cobre parte disso de forma fragmentada: a rota `/settings` redireciona para `/profile`, que hoje concentra senha, tema, idioma e preferências de UI (`reducedMotion`, `compact`); no mobile existem `biometric_service.dart` e `theme_cubit.dart`. Este desenho **consolida** essas peças numa IA coerente e define o que falta.

---

## 1. Arquitetura de informação (mapa das 9 áreas)

As nove áreas são agrupadas por afinidade e mapeadas ao contexto/módulo que as possui. Isso determina onde o dado vive, quem valida e como é auditado.

| Grupo | Área | Contexto (módulo dono) | Escopo do dado | Plataforma |
|-------|------|------------------------|----------------|------------|
| **Conta** | Perfil | `identity` (estende) | por **usuário** | web + mobile |
| **Conta** | Segurança | `identity` (estende) | por **usuário** + sessões | web + mobile |
| **Conta** | Biometria | `identity` (device) | por **dispositivo** (local) | **mobile** |
| **Organização** | Empresa | `organization` (**novo**) | por **tenant** | web (admin) |
| **Organização** | Integrações | `integrations` (**novo**) + `import` | por **tenant** | web (admin) |
| **Experiência** | Preferências | `user-settings` (**novo**) | por **usuário** | web + mobile |
| **Experiência** | Idioma | `user-settings` (**novo**) | por **usuário** | web + mobile |
| **Experiência** | Tema | `user-settings` (**novo**) | por **usuário** (client-first) | web + mobile |
| **Comunicação** | Notificações | `notifications` (**novo**) | por **usuário** (+ defaults do tenant) | web + mobile |

Três módulos novos de backend: **`user-settings`** (preferências/idioma/tema), **`organization`** (empresa) e **`notifications`** (preferências de canal). **`integrations`** pode nascer como extensão do catálogo de conectores já existente em `import` (ver `docs/modules/import-center.md` §7) mais chaves de API/webhooks. **Perfil**, **Segurança** e **Biometria** estendem o `identity`.

### 1.1 Visibilidade por papel (RBAC)

O que aparece na navegação depende do papel (`RolesGuard`, `@Roles(...)`):

| Área | `admin` | `dispatcher` | `driver` |
|------|:------:|:-----------:|:--------:|
| Perfil / Segurança / Biometria / Preferências / Idioma / Tema / Notificações | ✅ | ✅ | ✅ |
| Empresa | ✅ (edita) | 👁️ (lê) | ❌ |
| Integrações | ✅ | ❌ | ❌ |

Regra: áreas **por usuário** são sempre visíveis ao próprio; áreas **por tenant** (Empresa, Integrações) exigem `admin` para escrita.

---

## 2. Fluxo do usuário e navegação

### Web (`/settings`)
A rota deixa de ser um redirect e passa a ser o **shell** de Configurações, com navegação lateral (ou abas) e sub-rotas dedicadas — cada aba é *deep-linkável* e code-split:

```
/settings                     → redireciona para a 1ª aba visível ao papel
/settings/profile             → Perfil
/settings/security            → Segurança (senha, 2FA, sessões/dispositivos)
/settings/preferences         → Preferências + Idioma + Tema (grupo "Experiência")
/settings/notifications       → Notificações
/settings/company             → Empresa            (admin)
/settings/integrations        → Integrações        (admin)
```

Migração: `/profile` passa a ser *alias* de `/settings/profile` (mantém links salvos). Idioma e Tema, hoje soltos no perfil, migram para "Preferências".

### Mobile (Flutter)
Uma tela `SettingsPage` com lista agrupada (`ListView` seccionado), abrindo sub-telas. **Biometria** aparece só no mobile; **Empresa** e **Integrações** ficam ocultas para o `driver` (papel típico do app). Tema/idioma reusam `theme_cubit` e o `l10n` existente.

Padrão de interação (web e mobile): **auto-save por campo** com *toast* de confirmação em preferências de baixo risco (tema, idioma, toggles); **save explícito + reautenticação** em ações sensíveis (troca de senha, desativar 2FA, revogar sessão, salvar credencial de integração).

---

## 3. Detalhamento por área

Cada área descreve: **propósito**, **campos/opções**, **regras de negócio**, **endpoints (desenho)** e **notas de segurança**. Endpoints são propostas de contrato — não implementados.

### 3.1 Perfil — `identity`
**Propósito:** dados de identificação do usuário no tenant.
**Campos:** nome de exibição, avatar (upload), telefone, cargo/função (rótulo), fuso horário. E-mail é exibido; alterá-lo é fluxo separado com verificação (ver Segurança).
**Regras:** avatar ≤ 2 MB, tipos `image/png|jpeg|webp`; telefone validado E.164; `displayName` 2–80 chars. Fuso horário de lista IANA.
**Endpoints:** `GET /me/profile`, `PATCH /me/profile`, `POST /me/avatar` (multipart), `DELETE /me/avatar`.
**Segurança:** avatar servido via URL assinada com escopo de tenant; sanitização de metadados EXIF.

### 3.2 Empresa — `organization` (novo)
**Propósito:** dados cadastrais e operacionais do tenant.
**Campos:** razão social / nome fantasia, CNPJ, endereço, logotipo, fuso padrão da organização, moeda, unidades (métrico/imperial), janelas de operação padrão, membros da equipe (lista + convites + papéis).
**Regras:** CNPJ validado (dígitos verificadores); apenas `admin` edita; alteração de papel de membro não pode remover o **último** `admin` (invariante). Convite gera token de uso único com expiração.
**Endpoints:** `GET /org`, `PATCH /org`, `POST /org/logo`, `GET /org/members`, `POST /org/members/invitations`, `PATCH /org/members/{userId}` (papel/status), `DELETE /org/members/{userId}`.
**Segurança:** RLS por `app.current_tenant`; toda mutação auditada; convites com rate-limit.

### 3.3 Preferências — `user-settings` (novo)
**Propósito:** ajustes de experiência de UI por usuário, sincronizados entre dispositivos.
**Campos:** `reducedMotion`, `compact` (já existem no client), densidade de tabelas, página inicial padrão, formato de data/hora, primeiro dia da semana, unidades (herda de Empresa, sobrescrevível).
**Regras:** *client-first* com **sincronização best-effort**: aplica local imediatamente (localStorage / secure storage) e persiste no servidor; em conflito vence o `updatedAt` mais recente (last-write-wins por chave).
**Endpoints:** `GET /me/settings`, `PATCH /me/settings`.
**Nota:** hoje o `preferences-provider.tsx` só usa localStorage — o desenho adiciona *hidratação* a partir do servidor após login, mantendo o fallback offline.

### 3.4 Idioma — `user-settings`
**Propósito:** locale da interface.
**Opções:** derivadas de `LOCALES` (`dictionary.ts`) — ex.: `pt-BR`, `en`. Uma opção "seguir sistema".
**Regras:** persistido como parte de `user-settings` (`locale`); aplicado via `locale-provider` (web) e `l10n` (mobile). Fallback para `pt-BR`.
**Endpoints:** parte de `PATCH /me/settings` (`{ locale }`).

### 3.5 Tema — `user-settings`
**Propósito:** aparência (claro/escuro/sistema) e, futuramente, contraste/alto-contraste.
**Opções:** `light | dark | system` (já implementado via `next-themes` e `theme_cubit`).
**Regras:** *client-first*, sem *flash* (aplicado antes da hidratação); valor também sincronizado em `user-settings` (`theme`) para consistência entre dispositivos.
**Endpoints:** parte de `PATCH /me/settings` (`{ theme }`).

### 3.6 Segurança — `identity` (estende)
**Propósito:** proteção da conta.
**Recursos:**
- **Senha:** trocar senha (já existe `change-password.use-case`); política de força; invalida refresh tokens das outras sessões ao trocar.
- **Alterar e-mail:** novo e-mail → verificação por link/código; só efetiva após confirmação.
- **2FA/MFA (TOTP):** ativar/desativar; geração de *secret*, QR, verificação de código, **códigos de recuperação** de uso único.
- **Sessões e dispositivos ativos:** listar sessões (refresh tokens) com device/UA/último uso/IP aproximado; **revogar uma** ou **todas menos a atual**.
- **Log de atividade recente:** eventos de segurança do próprio usuário (login, troca de senha, 2FA).
**Endpoints:** `POST /me/password`, `POST /me/email/change` + `POST /me/email/verify`, `POST /me/mfa/totp/setup` + `/verify` + `DELETE /me/mfa/totp`, `GET /me/sessions`, `DELETE /me/sessions/{id}`, `DELETE /me/sessions` (todas menos atual).
**Segurança:** ações sensíveis exigem **reautenticação** (senha atual ou step-up MFA); *secret* TOTP e códigos de recuperação **criptografados AES-256** (envelope por tenant, ADR-0010); auditoria completa.

### 3.7 Biometria — `identity` (device, mobile)
**Propósito:** desbloqueio local do app por biometria (Face ID / Touch ID / impressão digital).
**Modelo:** **device-local**, não é credencial de servidor. A biometria protege o acesso ao *refresh token* guardado em **secure storage** (Keychain/Keystore). Reusa `biometric_service.dart`.
**Opções:** ativar/desativar biometria; exigir biometria ao abrir o app; timeout de reautenticação.
**Regras:** só habilitável se o dispositivo tiver biometria cadastrada; *fallback* para senha do app/PIN; ao desativar, o token protegido é reprotegido apenas por PIN/senha. Nenhum dado biométrico deixa o dispositivo.
**Persistência:** flag + parâmetros em secure storage local; opcionalmente registra *device* na lista de sessões do servidor (sem dado biométrico).

### 3.8 Notificações — `notifications` (novo)
**Propósito:** controlar **o que** o usuário recebe e **por qual canal**.
**Modelo (matriz evento × canal):** canais `in-app`, `email`, `push`, `sms`; eventos por domínio — ex.: `delivery.assigned`, `delivery.failed`, `route.optimized`, `import.completed`, `pod.rejected`, alertas de segurança. Cada célula é um toggle; alguns eventos críticos de segurança são **obrigatórios** (não desativáveis).
**Extras:** horário de silêncio (quiet hours), agrupamento/digest (imediato vs. resumo diário), registro de tokens de push por dispositivo.
**Camadas de default:** *default do sistema* → *default do tenant* (Empresa pode definir) → *override do usuário*. O efetivo é a resolução dessas camadas.
**Endpoints:** `GET /me/notifications/preferences`, `PATCH /me/notifications/preferences`, `POST /me/notifications/devices` (registrar push token), `DELETE /me/notifications/devices/{id}`; admin: `GET/PATCH /org/notifications/defaults`.
**Segurança:** verificação de e-mail antes de habilitar canal e-mail; opt-out sempre disponível (LGPD); push tokens tratados como dado de dispositivo.

### 3.9 Integrações — `integrations` (novo) + `import`
**Propósito:** conectar serviços externos e expor acesso programático.
**Grupos:**
- **Conectores de importação:** já modelados no `import` (§7 do doc de import) — famílias `file` (ativo), `capture` e `integration` (planejados). Configuração por tenant (credenciais, agendamento, webhooks de entrada).
- **Mapas/Geocodificação:** status do provedor (ex.: Mapbox), token gerido a nível de tenant/ambiente.
- **Webhooks de saída:** URLs assinadas para eventos (`delivery.*`, `route.*`), com *secret* de assinatura HMAC.
- **Chaves de API (M2M):** emitir/rotacionar/revogar chaves para acesso programático (ver `docs/security.md` §2.1); escopos por chave; exibir *segredo* apenas na criação.
**Endpoints:** `GET /integrations` (catálogo + status), `PUT /integrations/{id}/config` (credenciais/params), `POST /integrations/{id}/test`, `GET/POST/DELETE /org/api-keys`, `GET/POST/DELETE /org/webhooks`.
**Segurança:** **todas as credenciais e secrets criptografados AES-256** (envelope por tenant); segredo de chave/API mostrado **uma única vez**; teste de conexão sem persistir; auditoria de emissão/rotação/revogação; rate-limit em `test`.

---

## 4. Arquitetura backend (Clean Architecture / DDD)

Cada módulo segue o mesmo padrão em camadas do restante da API (`domain` → `application` → `infrastructure` → `interface`). Nenhum módulo "settings" agregador no backend — a agregação acontece no **frontend/BFF**.

```
modules/
├─ identity/                      # ESTENDE (existente)
│  ├─ application/                # + update-profile, change-email(+verify),
│  │                               #   setup-totp/verify/disable, list/revoke-sessions
│  ├─ domain/                     # + UserProfile (VO), MfaSecret (VO cifrado),
│  │                               #   Session/Device (do refresh token)
│  └─ interface/                  # + me.controller (profile, security, sessions, mfa)
│
├─ user-settings/                 # NOVO — preferências, idioma, tema (por usuário)
│  ├─ domain/
│  │  ├─ user-settings.ts         # agregado: theme, locale, ui prefs, formats
│  │  └─ ports/settings-repository.port.ts
│  ├─ application/
│  │  ├─ get-settings.use-case.ts
│  │  └─ update-settings.use-case.ts   # patch parcial, LWW por chave
│  ├─ infrastructure/persistence/       # orm-entity + repository (RLS/scoped)
│  └─ interface/me-settings.controller.ts
│
├─ organization/                  # NOVO — empresa/tenant (por tenant)
│  ├─ domain/
│  │  ├─ organization.ts          # agregado (dados cadastrais + config)
│  │  ├─ membership.ts            # papel do usuário no tenant + invariante "último admin"
│  │  ├─ invitation.ts            # convite (token único, expira)
│  │  └─ ports/{organization,membership,invitation}-repository.port.ts
│  ├─ application/                # get/update-org, invite/accept, change-role, remove-member
│  ├─ infrastructure/persistence/ # orm + repository (RLS)
│  └─ interface/organization.controller.ts
│
├─ notifications/                 # NOVO — preferências de canal (parte de um contexto maior)
│  ├─ domain/
│  │  ├─ notification-preferences.ts   # matriz evento×canal + quiet hours + digest
│  │  ├─ device-token.ts               # push token por dispositivo
│  │  └─ ports/{preferences,device-token}-repository.port.ts
│  ├─ application/                # get/update-preferences, register/unregister-device,
│  │                               #   get/update-tenant-defaults, resolve-effective (query)
│  ├─ infrastructure/persistence/
│  └─ interface/notifications.controller.ts
│
└─ integrations/                  # NOVO — credenciais, webhooks, chaves de API (por tenant)
   ├─ domain/
   │  ├─ integration-config.ts    # config por conector (credenciais cifradas)
   │  ├─ api-key.ts               # hash da chave + escopos + prefixo visível
   │  ├─ outbound-webhook.ts      # URL + secret HMAC + eventos assinados
   │  └─ ports/*-repository.port.ts + secret-cipher.port.ts
   ├─ application/                # upsert-config, test-connection, issue/rotate/revoke-key,
   │                               #   create/delete-webhook
   ├─ infrastructure/
   │  ├─ crypto/                  # adapter do envelope AES-256 (ADR-0010) → SECRET_CIPHER
   │  └─ persistence/
   └─ interface/integrations.controller.ts
```

**Reuso e anti-corrupção:**
- `integrations` **não** reimplementa conectores — consome o **catálogo do `import`** (porta `CONNECTOR_REGISTRY`) via gateway, e só adiciona a **configuração por tenant** (credenciais/agenda).
- Cifra de segredos é uma **porta** (`SECRET_CIPHER`) implementada sobre o envelope encryption por tenant já previsto em `docs/security.md` §4.1 — reutilizada por `identity` (MFA) e `integrations` (credenciais/webhooks).
- Notificações **emitidas** pertencem a um serviço de entrega (fora deste escopo de "Configurações"); aqui modelamos apenas **preferências** e sua resolução efetiva.

---

## 5. Contratos (`packages/contracts/src/settings.ts` — desenho)

Novo arquivo de contratos, exportado no `index.ts` ao lado de `auth`, `fleet`, etc. Formas descritas (Zod na implementação; aqui só o **shape**):

- `UserSettings`: `{ theme: 'light'|'dark'|'system'; locale: Locale; reducedMotion: boolean; compact: boolean; tableDensity; dateFormat; firstDayOfWeek; units; homePath }`
- `UpdateUserSettings`: `Partial<UserSettings>` (patch parcial).
- `UserProfile`: `{ displayName; phone?; jobTitle?; timeZone; avatarUrl? }`.
- `Organization`: `{ legalName; tradeName?; taxId; address; logoUrl?; timeZone; currency; units; ... }`.
- `Membership`: `{ userId; email; role: 'admin'|'dispatcher'|'driver'; status }`.
- `NotificationPreferences`: `{ channels: Record<EventKey, Record<Channel, boolean>>; quietHours?; digest }` com `Channel = 'in_app'|'email'|'push'|'sms'`.
- `SecuritySession`: `{ id; device; userAgent; lastUsedAt; current: boolean }`.
- `IntegrationSummary`: `{ id; kind; status: 'available'|'planned'|'configured'|'error'; requiresConfig }`.
- `ApiKeySummary`: `{ id; prefix; scopes; createdAt; lastUsedAt? }` (segredo **nunca** retornado após criação).

Reusa `Locale` de `dictionary.ts` para não duplicar a fonte de verdade dos idiomas.

---

## 6. Persistência e migrations (desenho)

Tabelas novas, todas **multi-tenant com RLS `ENABLE` + `FORCE`** e grant restrito ao role `navix_app`, seguindo o padrão de `import_batches`:

| Tabela | Escopo | Colunas sensíveis (AES-256) | Notas |
|--------|--------|------------------------------|-------|
| `user_profiles` | usuário | — | 1:1 com `users` |
| `user_settings` | usuário | — | JSONB validado por contrato; `updated_at` p/ LWW |
| `organizations` | tenant | — | 1:1 com tenant |
| `memberships` | tenant | — | invariante "último admin" na aplicação |
| `invitations` | tenant | token (hash) | expira; uso único |
| `notification_preferences` | usuário | — | matriz JSONB + quiet hours |
| `notification_devices` | usuário | push token (cifrado) | por dispositivo |
| `mfa_credentials` | usuário | **secret TOTP**, **recovery codes** | 1:1 com `users` |
| `integration_configs` | tenant | **credenciais** | por conector |
| `outbound_webhooks` | tenant | **HMAC secret** | eventos assinados |
| `api_keys` | tenant | **hash da chave** (Argon2/HMAC) | prefixo visível em claro |

Sessões/dispositivos reusam a tabela de **refresh tokens** já existente em `identity` (acrescentando metadados de device/UA/last-used, se ausentes).

---

## 7. Frontend

### Web (Next.js, `apps/web`)
```
app/(app)/settings/
├─ layout.tsx                 # shell: nav lateral + guarda de papel por aba
├─ page.tsx                   # → redireciona p/ 1ª aba visível (substitui redirect p/ /profile)
├─ profile/page.tsx
├─ security/page.tsx
├─ preferences/page.tsx       # Preferências + Idioma + Tema
├─ notifications/page.tsx
├─ company/page.tsx           # admin
└─ integrations/page.tsx      # admin
components/settings/          # cards, matriz de notificações, lista de sessões, etc.
lib/settings/                 # hooks React Query (get/patch), sync de user-settings
```
Reuso: `preferences-provider` ganha hidratação server-side; `locale-provider`, `next-themes`, componentes `ui/*` (Card, Tabs, Switch, Field, Toast) já existentes. Padrão de mutação com React Query + *optimistic update* nos toggles de baixo risco.

### Mobile (Flutter, `apps/mobile`)
```
lib/features/settings/
├─ presentation/  settings_page.dart + subtelas (profile, security, preferences,
│                  notifications, biometric)
├─ application/   cubits (settings, notifications) — reusa theme_cubit
└─ data/          repositórios (api + secure storage)
```
Biometria via `core/security/biometric_service.dart`; tema via `core/theme/theme_cubit.dart`; idioma via `l10n`. Empresa/Integrações ocultas para `driver`.

---

## 8. Segurança (OWASP · AES-256 · JWT · auditoria)

Alinhado a `docs/security.md`:

- **Autorização (A01):** `JwtAuthGuard` + `RolesGuard` em todas as rotas; áreas por tenant exigem `admin`; verificação **object-level** (usuário só acessa o próprio perfil/settings; membro só do próprio tenant via RLS).
- **Criptografia (A02):** segredos em repouso com **AES-256** via envelope encryption por tenant (ADR-0010): secret TOTP, recovery codes, credenciais de integração, HMAC de webhook, push tokens. Chaves de API guardadas como **hash** (nunca reversível); segredo exibido só na emissão.
- **Reautenticação / step-up:** troca de senha, alterar e-mail, ativar/desativar 2FA, revogar sessões e salvar credenciais exigem senha atual ou desafio MFA.
- **Sessões (JWT + Refresh):** trocar senha e "revogar todas" invalidam refresh tokens; rotação de refresh já prevista no `identity`.
- **Validação de entrada (A03):** DTOs/Zod em toda mutação; CNPJ, E.164, tamanho/tipo de upload, listas fechadas (locale/theme/timezone).
- **Uploads:** avatar/logo com validação de tipo real (magic bytes), limite de tamanho, remoção de EXIF, servidos por URL assinada com escopo de tenant.
- **Rate-limiting (A04/A07):** login, troca de senha, verificação de e-mail, `integration/test`, emissão de chave e convites.
- **Auditoria:** eventos `profile.updated`, `email.change_requested/confirmed`, `password.changed`, `mfa.enabled/disabled`, `session.revoked`, `org.updated`, `member.invited/role_changed/removed`, `integration.configured`, `apikey.issued/rotated/revoked`, `webhook.created/deleted` — todos com `actor`, `tenant`, `ip`, `timestamp`.
- **Privacidade (LGPD/GDPR):** opt-out de canais sempre disponível; export/erasure de dados de perfil no roadmap; nenhum dado biométrico transita para o servidor.

---

## 9. Configuração (env vars previstas)

| Variável | Uso |
|----------|-----|
| `TENANT_KEK_*` | Chaves-mestras do envelope encryption (já previsto em security.md §4.1). |
| `MAPBOX_TOKEN` | Provedor de mapas/geocodificação (já usado pelo `import`). |
| `SMTP_*` / provider de e-mail | Verificação de e-mail e canal de notificação por e-mail. |
| `PUSH_*` (FCM/APNs) | Canal de push. |
| `SMS_*` | Canal de SMS (opcional). |

---

## 10. Plano de implementação por etapas

Validar cada etapa antes de seguir (conforme diretriz do projeto):

1. **Fundação de settings do usuário** — ✅ **implementada**: módulo `user-settings` (contrato `@navix/contracts/settings`, `GET/PATCH /api/v1/me/settings`, tabela `user_settings` com RLS, auditoria `settings.updated`, testes). No web: `SettingsSyncProvider` hidrata Tema/Idioma/Preferências do servidor após login (client-first com fallback offline), shell `/settings` com sub-rotas por papel, `/profile` → alias de `/settings/profile`.
2. **Perfil + Segurança** — 🟡 **Perfil implementado**: `identity` estendido com `UserProfile` (nome, telefone E.164, cargo, fuso) e avatar (data URL), `GET/PATCH /api/v1/me/profile` + `PUT/DELETE /me/profile/avatar`, tabela `user_profiles` com RLS, auditoria (`profile.updated`, `profile.avatar.*`), testes; no web, aba Perfil com formulário editável + upload de avatar. **Pendente (2b/2c):** alterar e-mail com verificação e sessões/dispositivos com revogação.
3. **2FA (TOTP):** setup/verify/disable + recovery codes cifrados + step-up.
4. **Empresa:** módulo `organization` (dados, membros, convites, invariante do último admin).
5. **Notificações:** módulo `notifications` (matriz de preferências, defaults do tenant, registro de push).
6. **Integrações:** módulo `integrations` sobre o catálogo de conectores + chaves de API + webhooks (todos os segredos cifrados).
7. **Biometria (mobile):** consolidar sobre `biometric_service`, com gate de abertura e timeout.

Cada etapa entra com: contrato em `packages/contracts`, testes (unidade de use-cases + RLS), auditoria e atualização deste documento.

---

## 11. Decisões em aberto

- **Notificações — contexto próprio vs. sub-módulo:** preferências ficam em `notifications`, mas a **entrega** (fila/worker) deve ser um serviço à parte; definir a fronteira quando a entrega for implementada.
- **2FA — TOTP apenas ou também WebAuthn/passkeys:** desenho cobre TOTP; passkeys ficam como evolução.
- **Sincronização de preferências:** LWW por chave é suficiente no curto prazo; avaliar CRDT/merge se houver edição concorrente intensa (improvável).
- **Integrações vs. Import:** manter `integrations` fino (config por tenant) e delegar o catálogo ao `import`, ou promover um contexto de "conectores" compartilhado — decidir ao implementar a etapa 6.
```
