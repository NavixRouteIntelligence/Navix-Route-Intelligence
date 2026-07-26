# Sprint — Ciclo completo do Motorista Autônomo

> **Objetivo:** fechar o primeiro fluxo demonstrável de ponta a ponta da Navix, com
> **um único usuário** e sem depender de nenhuma funcionalidade corporativa:
>
> **importar entregas → otimizar a rota → seguir a rota → registrar o POD**
>
> **Status:** proposta · **Autor:** CTO · **Data:** 2026-07-19

---

## 1. Por que este escopo

O app do motorista já tem a tela mais bem construída do produto (`DriverDashboardPage`,
~1.000 linhas: rota, inteligência da parada, mini mapa, tracking, POD, assistente de
voz, fila offline). O problema é que ela **está passando fome**: não existe nenhuma
porta pela qual uma entrega entre na vida do motorista autônomo. O resultado é a tela
"Sem rota ativa", permanentemente.

A alternativa (começar pelo convite de motorista da Empresa) exige multi-usuário,
vínculo de tenant e RBAC — muito mais superfície. O caminho do **autônomo** entrega
valor demonstrável com uma fração do esforço.

### O que já existe (não precisa ser feito)

| Peça | Estado |
|------|--------|
| `POST /imports/preview` e `/imports/:id/confirm` | ✅ já aceitam o papel `driver` |
| `POST /route-plans/mine` | ✅ existe, com `@Roles('driver')` |
| `GET /deliveries` | ✅ sem restrição de papel (escopado por tenant via RLS) |
| `ImportCenterPage` (Flutter) | ✅ construída (476 linhas) |
| `OptimizerPage` (Flutter) | ✅ construída (588 linhas) |
| `deliveries_repository` / `deliveries_cubit` / `delivery_summary` | ✅ criados no commit `31144ee` |
| `DriverDashboardPage`, captura de POD, fila offline | ✅ construídos |

**Conclusão:** o trabalho é majoritariamente **wiring de UI no Flutter**. O backend
praticamente não muda. Isso reduz risco e prazo.

---

## 2. Escopo (em ordem de execução)

Cada item é entregável e testável isoladamente. Não avance sem o anterior validado.

### S1 — Aba "Entregas" do Motorista

Substituir o `PlaceholderPage` do `DriverShell` por uma lista real, reaproveitando o
que já foi feito para a Empresa.

- **Arquivos:** `lib/app/shell/driver_shell.dart`,
  `lib/features/deliveries/presentation/driver_deliveries_page.dart` *(novo)*,
  reuso de `deliveries_repository.dart` / `deliveries_cubit.dart`.
- **Backend:** nenhuma mudança.
- **Nota de arquitetura:** avaliar parametrizar a página existente em vez de duplicar
  (evitar código duplicado — se a diferença for só de ações/colunas, extraia um widget
  comum e mantenha duas cascas finas).

**Critérios de aceite**
- Motorista vê a lista das próprias entregas com status.
- Estados de carregando / vazio / erro cobertos (padrão `navix_states`).
- Teste de cubit para sucesso, lista vazia e falha de rede.
- Strings em pt-BR, pt-PT, en e es.

### S2 — Importar entregas no perfil do Motorista

Dar ao autônomo a porta de entrada de entregas. **O backend já permite.**

- **Decisão de UX:** não criar uma 4ª aba. Colocar a ação **"Importar"** dentro da aba
  Entregas (botão no topo ou FAB), abrindo a `ImportCenterPage` já existente. Mantém a
  navegação do motorista enxuta (ele opera dirigindo).
- **Arquivos:** `driver_deliveries_page.dart`, `driver_shell.dart` (rota/push),
  reuso de `ImportCenterPage` e `import_repository.dart`.
- **Backend:** nenhuma mudança.

**Critérios de aceite**
- Motorista importa o `entregas-teste.csv` (na raiz do repo) e vê o preview.
- Ao confirmar, as entregas aparecem na aba Entregas e no dashboard.
- As entregas são criadas **no tenant do próprio motorista** (validar isolamento).
- Erro de arquivo inválido é tratado com mensagem clara.

### S3 — Otimizador no perfil do Motorista

A tela existe, mas hoje chama `POST /route-plans`, que é de `admin`/`dispatcher`. O
motorista precisa usar `POST /route-plans/mine`.

- **Arquivos:** `lib/features/optimizer/data/optimizer_repository.dart` (novo método
  `optimizeMine()`), `optimizer_cubit.dart`, `driver_dashboard_page.dart` (botão
  "Otimizar minha rota"), `driver_shell.dart`.
- **Backend:** nenhuma mudança esperada — **mas** confirmar o contrato de
  `/route-plans/mine` antes de codar (pode divergir do `/route-plans`).
- **Nota:** não duplicar o fluxo do otimizador; parametrizar o endpoint por papel
  dentro do repositório, mantendo uma única `OptimizerPage`.

**Critérios de aceite**
- Motorista otimiza e o dashboard passa a mostrar "Minha rota — entrega 1 de N".
- Sequência de paradas coerente com as entregas importadas.
- Falha do otimizador exibe erro tratado (não trava a tela).
- Teste de cubit para o caminho `mine`.

### S4 — Validação ponta a ponta com POD real

- Rodar o ciclo completo num **iPhone físico** (o simulador não tem câmera).
- Confirmar o objeto no bucket **`navix-pod`** (Cloudflare R2, jurisdição UE).
- Confirmar a exibição da foto via URL assinada.

**Critérios de aceite**
- POD registrado com foto + assinatura + GPS.
- Objeto presente no R2; link assinado abre a imagem e expira conforme
  `MEDIA_URL_TTL_SECONDS`.
- Fila offline: com o aparelho em modo avião, o POD entra na fila e sincroniza ao
  voltar a conexão.

---

## 3. Fora de escopo (backlog explícito)

Registrado para evitar *scope creep*. Nada abaixo entra nesta sprint:

- **Convite de motorista pela Empresa** (beta-roadmap #1) — exige multi-usuário e
  vínculo de tenant. É a próxima sprint natural.
- **Criação manual de entrega pelo motorista** — a importação já cobre a necessidade
  de entrada de dados; criar CRUD manual agora é esforço sem retorno proporcional.
- **CX do destinatário** (rastreamento público) — maior lacuna competitiva, mas é
  produto novo, não fechamento de ciclo.
- **Worker dedicado / migração AWS** — infraestrutura, já planejada em
  `docs/infrastructure/`.

---

## 4. Riscos

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | Contrato de `/route-plans/mine` divergir do esperado | Ler o DTO e o use-case **antes** de codar o S3; ajustar o modelo no app |
| R2 | Import criar entregas no tenant errado | Teste explícito de isolamento: importar com 2 contas distintas e conferir que uma não vê a outra |
| R3 | Duplicação de código entre páginas de Empresa e Motorista | Extrair widget compartilhado; revisão de código bloqueia duplicação |
| R4 | Otimização em modo `inprocess` degradar a API sob carga | Aceitável no piloto (ADR-0007/0055). Ao subir volume, ativar o `navix-worker` e voltar a `bullmq` |
| R5 | S4 depende de aparelho físico | Agendar; S1–S3 não bloqueiam |

---

## 5. Definição de pronto (aplica-se a todos os itens)

- Testes de cubit cobrindo sucesso, vazio e erro.
- Tratamento de erro tipado (`Failure`), sem exceção vazando para a UI.
- i18n nos 4 locales suportados.
- Acessibilidade: alvos de toque ≥ 48px, contraste, `semanticsLabel` nos ícones de ação.
- Commits pequenos e descritivos; ADR quando houver decisão arquitetural
  (ex.: seleção de endpoint por papel no repositório).
- Documentação atualizada (`docs/mobile-architecture.md` — hoje está defasada, diz que
  não há código).

---

## 6. Impacto e recomendação

**Impacto:** transforma a Navix de "plataforma no ar" em "produto demonstrável". Após
esta sprint é possível gravar um vídeo do ciclo completo para clientes e investidores,
e o R2 passa a ser exercitado de verdade.

**Esforço estimado:** S1 e S2 são pequenos (reuso alto). S3 é médio (contrato + wiring).
S4 é validação. O gargalo é revisão e testes, não código novo.

**Recomendação:** aprovar S1→S4 nesta ordem. Manter o convite de motorista pela
Empresa como a sprint seguinte — ela destrava o mercado B2B, mas só faz sentido depois
que o ciclo básico estiver provado.
