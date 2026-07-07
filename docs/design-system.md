# Design System — Navix

> **Status:** Estável (v1) · **Atualizado:** 2026-07-06 · **Style guide navegável:** `/design-system`

O Design System da Navix é a **única** fonte de UI do produto. Toda tela nova deve consumir estes tokens e componentes — nada de estilos ad-hoc ou cores fora da paleta.

## 1. Identidade

- **Marca:** Navix — inteligência logística de última milha.
- **Glifo:** um caminho (rota) pontilhado terminando em um pino de destino (`components/ui/logo.tsx`).
- **Cores da marca:** **Navix Indigo** (primária, matiz 250) e **Route Teal** (acento de rotas/otimização, matiz 172).
- **Tom visual:** limpo, muito respiro, bordas sutis, cantos arredondados — inspirado em Stripe/Linear.

## 2. Tokens

Definidos como CSS variables (HSL) em `src/app/globals.css` e expostos no Tailwind (`tailwind.config.ts`). Suportam **tema claro e escuro** por classe `.dark` (via `next-themes`).

### Cores semânticas
`background`, `surface`, `card`, `foreground`, `muted(+foreground)`, `border`, `input`, `ring`,
`primary(+foreground)`, `accent(+foreground)`, `success`, `warning`, `danger`, `chart-1..5`.

Uso: sempre via classes utilitárias (`bg-primary`, `text-muted-foreground`, `border-border`…). **Nunca** hex/rgb fixos.

### Tipografia
Fonte **Inter** (`--font-sans`) + mono para IDs. Escala: `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-base`, `text-sm`. Mono via `font-mono`.

### Raio e sombra
`--radius` base (0.7rem); `rounded-{sm,md,lg,xl}`. Sombras `shadow-card` e `shadow-elevated`.

## 3. Componentes

Todos em `src/components/ui/` (e layout em `src/components/layout/`). Acessíveis (Radix onde há interação), com foco visível e navegação por teclado.

| Categoria | Componentes |
|-----------|-------------|
| Marca | `Logo`, `LogoMark` |
| Ações | `Button` (primary/accent/secondary/outline/ghost/danger · sm/md/lg/icon · `loading`) |
| Formulário | `Field`, `Input`, `Textarea`, `Select`, `Label` |
| Dados | `Card`, `Table`, `StatCard`, `Badge`, `*StatusBadge`, `PageHeader` |
| Feedback / estados | `Alert` (info/success/warning/error), `useToast`/`ToastProvider`, `Skeleton` (loading), `Spinner`, `EmptyState` |
| Overlays | `Dialog`, (Tooltip/Tabs quando necessário) |

### Estados padronizados
- **Loading:** `Skeleton` (blocos) ou `Spinner` (ações). `StatCard` e botões têm `loading`.
- **Vazio:** `EmptyState` com ícone + ação.
- **Erro:** `Alert tone="error"` (bloco) ou `toast({ tone: 'error' })` (transitório); erros de campo no `Field`.
- **Sucesso:** `toast({ tone: 'success' })` ou `Alert tone="success"`.

## 4. Ícones

Biblioteca única: **lucide-react**. Tamanho padrão `h-4 w-4` (inline) / `h-5 w-5` (destaque). Sempre com `aria-hidden` quando decorativos, ou `aria-label` quando informativos.

## 5. Responsividade

Mobile-first. Breakpoints do Tailwind (`sm/md/lg/xl/2xl`). Container centralizado (`container`, max 1360px). A sidebar colapsa em telas `< md` (a navegação mobile pode ser adicionada conforme necessidade). Grades usam `grid-cols` responsivas.

## 6. Acessibilidade

- Contraste AA nos tokens de texto/fundo (claro e escuro).
- `:focus-visible` global com anel do token `ring`.
- Componentes interativos via Radix (roles/ARIA corretos): Dialog, Label, etc.
- `prefers-reduced-motion` respeitado (animações reduzidas).
- Formulários com `Field` vinculando `label`/erro por id.

## 7. Regras de uso (obrigatórias)

1. **Só** cores/tokens do DS — sem hex/rgb soltos.
2. Reutilize componentes existentes antes de criar novos; novos componentes entram em `components/ui/` e nesta doc.
3. Todo estado (loading/erro/vazio/sucesso) usa os componentes de feedback do DS.
4. Ícones apenas do lucide-react.
5. Valide claro **e** escuro ao criar telas.

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-06 | 1.0 | Frontend | Design System inicial (identidade, tokens, componentes, style guide) |
