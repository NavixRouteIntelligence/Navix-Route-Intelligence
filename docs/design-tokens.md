# Navix — Design Tokens (fonte única)

> Referência **compartilhada** entre Web (Next.js/Tailwind) e Mobile (Flutter).
> Ambas as plataformas devem implementar estes tokens. Tema **escuro é o padrão**,
> com suporte **completo** ao claro. Alterou aqui → alinhe nos dois lados.

## 1. Cores — semânticas (dark / light)

| Token | Papel | Dark | Light |
|-------|-------|------|-------|
| `primary` | marca / ação | `#6D4AFF` | `#6D4AFF` |
| `primaryFg` | texto sobre primary | `#FFFFFF` | `#FFFFFF` |
| `accent` | destaque secundário | `#22D3AA` | `#0FB894` |
| `success` | positivo | `#22C55E` | `#16A34A` |
| `warning` | atenção | `#F59E0B` | `#D97706` |
| `danger` | erro/negativo | `#EF4444` | `#DC2626` |
| `bg` | fundo da tela | `#0B0B12` | `#F7F7FB` |
| `surface` | cartões | `#14141D` | `#FFFFFF` |
| `surfaceAlt` | cartões aninhados/hover | `#1B1B27` | `#F1F1F6` |
| `line` | bordas/divisores | `#262636` | `#E6E6EE` |
| `text` | texto primário | `#F3F3F7` | `#16161D` |
| `muted` | texto secundário | `#9AA0B4` | `#5B6072` |

Regras: contraste mínimo AA (texto/`muted` sobre `surface`). Cores de estado
(`success/warning/danger`) sempre acompanhadas de rótulo/ícone (nunca só cor).

## 2. Espaçamento (base 4)

`xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32`

## 3. Raio

`sm 8 · md 12 · lg 16 · pill 999`

## 4. Tipografia (escala)

| Token | Tamanho / peso |
|-------|----------------|
| `display` | 28 / 700 |
| `h1` | 22 / 680 |
| `h2` | 18 / 650 |
| `h3` | 15 / 620 |
| `body` | 14 / 450 |
| `label` | 12.5 / 500 |
| `caption` | 11.5 / 500 |

Fonte: Inter (web) / Roboto-Inter equivalente (mobile). Números com `tabular-nums`.

## 5. Elevação

Flat. Sem sombras fortes: cartões usam `surface` + borda `line` (1px). Overlays
(diálogos/sheets) podem usar sombra suave única.

## 6. Motion (micro-animações)

| Token | Duração | Curva | Uso |
|-------|---------|-------|-----|
| `fast` | 120ms | easeOut | hover, press, chips |
| `base` | 200ms | easeOutCubic | fade/scale de entrada, troca de conteúdo |
| `slow` | 320ms | easeOutCubic | barras/gráficos, sheets |

Respeitar `prefers-reduced-motion` (web) / desativar animações quando o usuário
pedir (mobile — preferência "reduzir animações").

## 7. Componentes (paridade)

Mesmos nomes/comportamento nos dois lados: `Card`, `Button` (primary/outline/ghost),
`KpiCard` (ícone + valor + chip de variação), `StatChip` (▲/▼ %), `StatusPill`,
`SectionHeader`, `Donut`, `BarChart`, `Skeleton/Shimmer`, `EmptyState`, `ErrorState`,
`Toast/Snackbar`.

## 8. Estados obrigatórios em toda tela com dados

`loading` (skeleton) · `empty` (EmptyState com ação) · `error` (ErrorState com retry)
· `success/feedback` (toast/snackbar). Ações principais em **1 toque/clique**.

## 9. Implementação por plataforma (conformidade)

| Token | Web (Next.js) | Mobile (Flutter) |
|-------|---------------|------------------|
| Cores | CSS vars HSL em `globals.css` (`--primary`, `--accent`, `--success`, `--warning`, `--danger`, `--surface`, `--border`, `--muted`) | `ColorScheme` + `NavixTokens` (ThemeExtension) |
| Tema padrão | `dark` (next-themes `defaultTheme="dark"`, claro completo) | `dark` (ThemeMode, claro completo, `ThemeCubit`) |
| Motion | `--motion-fast/base/slow` | `NavixTokens.motionFast/Base/Slow` |
| Componentes | `StatCard`, `StatChip`, `Badge`, `EmptyState`, `ErrorState`, `Skeleton`, `Toast`, charts (recharts) | `NavixKpiCard`, `NavixStatChip`, `NavixStatusPill`, `NavixEmptyState`, `NavixErrorState`, `NavixSkeleton`, `NavixDonut`, `NavixBarChart`, Snackbar |

Ambas as plataformas seguem os mesmos valores semânticos desta doc. Alterou um
token aqui → atualize os dois mapeamentos acima.
