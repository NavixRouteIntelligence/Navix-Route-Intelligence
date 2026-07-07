# Roteiro de demonstração — MVP Navix

> Demo navegável de ponta a ponta: da autenticação à otimização de rotas no mapa.

## Pré-requisitos

1. Docker Desktop aberto.
2. `npm run docker:up` · `npm run migration:run` · `npm run seed -w apps/api` (cria o tenant + admin).
3. `npm run dev:api` (backend) e `npm run dev:web` (frontend).
4. (Opcional) `NEXT_PUBLIC_MAPBOX_TOKEN` em `apps/web/.env.local` para o mapa.

Credenciais de demo: tenant `019f335f-a2ae-7dd9-bcda-d458fe138c98` · `admin@navix.test` · `ChangeMe123!`.

## Roteiro (≈ 5 min)

1. **Login** (`/login`) — mostrar o card, tema (claro/escuro no toggle da topbar) e entrar.
2. **Dashboard** (`/dashboard`) — KPIs (entregas, em rota, entregues, economia da última rota), gráfico "Entregas por status", painel de frota e otimizações recentes.
3. **Frota** — em **Veículos** e **Motoristas**, cadastrar 2–3 de cada (diálogo com validação), editar um, mostrar o toast de sucesso.
4. **Entregas** (`/deliveries`) — cadastrar 4 entregas com coordenadas espalhadas (ex.: `-23.55/-46.63`, `-23.63/-46.65`, `-23.50/-46.60`, `-23.58/-46.70`), mostrar filtros, paginação e a **mudança de status inline**.
5. **Otimizador** (`/optimizer`) — selecionar as 4 entregas, clicar **Otimizar**. Mostrar as métricas (distância, tempo, **economia %**, **score**), a **explicação** e o **mapa** com a rota e as paradas numeradas. Abrir um plano do **histórico**.
6. **Perfil** (`/profile`) — dados da conta, papéis, e trocar a senha.
7. **Design System** (`/design-system`) — encerrar mostrando a identidade e os componentes.

## Dicas

- **Economia** só aparece com **3+ paradas** (com 2 pontos há uma única rota possível).
- Sem token Mapbox, o passo 5 mostra a sequência de paradas em lista (fallback) — a otimização funciona igual.
- Transições de status inválidas na tela de Entregas retornam um toast de erro (a máquina de estados é validada no backend).

## O que este MVP demonstra

Autenticação segura (JWT RS256 + refresh), isolamento multi-tenant (RLS), gestão
de frota e entregas, e o **diferencial**: otimização de rotas com métricas de
economia e visualização em mapa — tudo sobre um Design System próprio, com dark
mode e responsividade.
