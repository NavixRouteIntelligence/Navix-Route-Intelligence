# Frontend — Navix

> **Status:** MVP navegável · **Atualizado:** 2026-07-06

Aplicação web (Next.js) que consome exclusivamente a API da Navix e o
[Design System](./design-system.md). Estética Stripe/Linear, dark mode, responsivo.

## Stack

- **Next.js 14 (App Router)** + TypeScript
- **Tailwind CSS** (design tokens) + **Radix UI** (acessibilidade) + **next-themes** (dark mode)
- **TanStack Query** (estado de servidor) · **React Hook Form + Zod** (formulários)
- **Recharts** (gráficos) · **Mapbox GL / react-map-gl** (mapa) · **lucide-react** (ícones)
- **Vitest + Testing Library** (testes)

## Estrutura

```
apps/web/src/
  app/
    (auth)/        login · forgot-password
    (app)/         dashboard · deliveries(/new,/[id]/edit) · fleet/(drivers,vehicles) · optimizer(/[id]) · profile
    design-system/ style guide público
  components/
    ui/            Design System (Button, Card, Table, Dialog, Toast, …)
    layout/        Sidebar, Topbar, ThemeToggle
    charts/        StatusChart (Recharts)
    map/           RouteMap (Mapbox, com fallback sem token)
    deliveries/    DeliveryForm · optimizer/ RoutePlanView
  lib/
    api/           client (fetch + refresh automático) · auth · deliveries · fleet · optimizer
    auth/          AuthProvider (sessão, refresh, guarda de rota)
    utils · labels
  test/            setup do Vitest
```

## Autenticação

- Login → guarda `accessToken` (memória) + `refreshToken` (localStorage).
- O `apiRequest` injeta `Authorization: Bearer` e, em `401`, tenta `POST /auth/refresh` e repete; se falhar, faz logout.
- `AuthProvider` restaura a sessão no load e protege as rotas de `(app)`.
- Ressalva de produção: o ideal é `refreshToken` em cookie httpOnly via BFF (hoje, para o MVP, fica em localStorage).

## Telas

| Rota | Descrição |
|------|-----------|
| `/login`, `/forgot-password` | Acesso e recuperação de senha |
| `/dashboard` | KPIs, gráfico por status, frota, otimizações recentes |
| `/deliveries` | Lista com filtros, paginação, status inline; `/new` e `/[id]/edit` |
| `/fleet/vehicles`, `/fleet/drivers` | CRUD com diálogos e confirmação |
| `/optimizer` | Seleção de entregas → otimizar → Route Plan (métricas + mapa + paradas) · `/[id]` |
| `/register` | Criação de conta (Motorista Autônomo × Empresa) |
| `/driver` | Dashboard do Motorista (rota, mapa, ações, compartilhar localização) |
| `/tracking` | Rastreamento da frota em tempo real (empresa) |
| `/settings` | Configurações: tema, idioma, empresa (read-only) e preferências |
| `/profile` | Dados da conta e troca de senha |
| `/design-system` | Style guide navegável |

## Produtividade e experiência

- **i18n** (`lib/i18n`): `LocaleProvider` + `useT()` com dicionário PT-BR/EN, aplicado às áreas principais (shell, configurações, estados e páginas de sistema). Persistido em `localStorage`; mantém `<html lang>` em sincronia.
- **Preferências** (`lib/preferences`): reduzir animações e modo compacto, persistidas e refletidas via classes no `<html>` (mais `prefers-reduced-motion`).
- **Páginas de sistema**: 404 (`not-found.tsx`), 500 (`error.tsx`), 403 (via guarda de RBAC no layout, `components/system/forbidden.tsx`) e **Sem Conexão** (`OfflineOverlay`, eventos `online`/`offline`). Base comum em `StatusScreen`.
- **Estados**: `Skeleton`, `EmptyState`, `ErrorState`, `SuccessState`, `Spinner` e `loading.tsx` de rota.
- **Feedback**: `Toast`, `Tooltip` (acessível, hover + foco), animações sutis (`fade-in`, `scale-in`, `toast-in`).
- **Busca global** (⌘K): entregas, veículos, motoristas, rotas e importações + navegação rápida.
- **Notificações**: rotas otimizadas, entregas e importações, com contador de não lidas.
- **Acessibilidade (WCAG)**: skip-link, landmark `main#main`, foco visível global, `aria-*`/roles em navegação, switches e diálogos, respeito a `prefers-reduced-motion`.

> Persistência de tema/idioma/preferências é **client-side** (não há endpoint para isso); a seção "Empresa" das Configurações é read-only a partir de `/auth/me`. "Clientes" não é uma entidade própria da API — a busca cobre o destino/cliente via entregas (endereço + observações).

## Executar

```bash
npm install
npm run build -w packages/contracts
npm run dev:web         # http://localhost:3000  (backend em dev:api)
npm run test -w apps/web
```

Variáveis (Next lê de `apps/web/.env.local`):
- `NEXT_PUBLIC_API_BASE_URL` — padrão `http://localhost:3001/api`.
- `NEXT_PUBLIC_MAPBOX_TOKEN` — token público do Mapbox (sem ele, o mapa mostra fallback com a sequência de paradas).

## Regras

Toda UI usa o Design System (`components/ui`). Sem cores fora dos tokens, sem
componentes ad-hoc. Estados de loading/erro/vazio/sucesso usam os componentes de
feedback do DS. Ver [design-system.md](./design-system.md).
