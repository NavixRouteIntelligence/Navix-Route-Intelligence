# Navix — Evolução Estratégica (Conselho de Produto)

> **Formato:** parecer de um conselho (CTO Uber · Head de Produto Amazon Logistics ·
> VP Eng Tesla · Head de IA OpenAI · Diretor de Design Linear), **ancorado no código
> real** da plataforma — não na moldura idealizada.
> **Data:** 2026-07-19 · **Autor:** CTO Navix

---

## 0. Calibração honesta do ponto de partida

Antes de propor o futuro, o conselho alinha o presente — porque recomendar sobre uma
base que não existe é como projetar o 3º andar sem ter o 1º. O que **de fato** está em
produção hoje:

| Área | Estado real |
|------|-------------|
| Backend multi-tenant (RLS no banco, não só na app) | ✅ Sólido e verificado |
| API REST versionada, contratos compartilhados | ✅ |
| Otimizador de rotas (VRP) | ✅ **heurístico** (Haversine/regras); roda **inprocess** no piloto |
| Tracking ao vivo (SSE + Redis) | ✅ |
| Import Center (CSV/XLSX/PDF) | ✅ |
| POD (foto+assinatura+GPS, fila offline) | ✅ + storage R2/UE |
| Painel Web (login, dashboard, importar, tracking) | ✅ |
| App Flutter (motorista e empresa) | ✅ ~9.600 linhas |
| **Ports de IA** (TrafficModel, ParkingPredictor, LoadPlanner) | ⚠️ Existem, mas **entregam heurística**, não modelo treinado |
| **Flywheel de inteligência coletiva** (observar→agregar por célula ~110m→prever) | ⚠️ Arquitetado; ainda coletando dados |
| Gestão de motoristas / convite de motorista pela empresa | ❌ **Não existe** |
| Aba "Entregas" no app do motorista | ❌ Placeholder |
| Reotimização dinâmica automática | ❌ Só manual |
| CX do destinatário (rastreamento público) | ❌ **Maior lacuna competitiva** |
| TimescaleDB / read models (CQRS) / worker dedicado | ❌ Planejado, não ativo |
| CI/CD, IaC, backup testado, teste de carga | ⚠️ Parcial (ver `docs/infrastructure/`) |

**A tese central do conselho:** a Navix é forte em *engenharia* e fraca em *dois
ativos que definem o vencedor deste mercado* — (a) **inteligência que melhora sozinha
com escala** (o flywheel, hoje inerte) e (b) **a experiência do destinatário final**
(hoje ausente). Toda a estratégia abaixo orbita esses dois eixos, porque são os únicos
que um concorrente **não copia comprando software**.

> **Princípio guia (recusa de scope creep):** não redesenhamos nada que já funciona.
> Só entram evoluções que movem receita, retenção ou o fosso competitivo.

---

## 1. Inteligência Artificial

> Nota estratégica: a maior alavanca de IA da Navix **não** é adicionar mais modelos —
> é **ligar o flywheel que já foi arquitetado**. Cada entrega hoje descarta o dado que
> treinaria o modelo de amanhã. Isso é o ativo composto.

### 1.1 Ativar o flywheel de ETA/tempo-de-parada (heurística → modelo real)
- **Problema:** os ports de IA existem mas devolvem heurística; o ETA erra e ninguém aprende com o erro.
- **Empresas:** ETA confiável reduz reclamação de cliente final e chamadas ao suporte.
- **Motoristas:** menos pressão por atraso "fantasma"; janelas realistas.
- **Diferencial:** modelo **por tenant + por célula geográfica** que melhora com o volume — fosso que cresce sozinho.
- **Dificuldade:** Alto.
- **Retorno:** Alto (precisão de ETA é o núcleo de percepção de qualidade).
- **Dependências:** TimescaleDB (série histórica) + pipeline de features + coleta já instrumentada (observações coletivas).
- **Prioridade:** Próximo Sprint (começar coleta e baseline agora; modelo evolui contínuo).

### 1.2 Reotimização dinâmica em tempo real
- **Problema:** um atraso, cancelamento ou nova entrega não recalcula a rota — só manualmente.
- **Empresas:** operação se auto-corrige; menos intervenção do dispatcher.
- **Motoristas:** rota sempre reflete a realidade da rua.
- **Diferencial:** paridade com Onfleet/Bringg no que eles cobram caro.
- **Dificuldade:** Médio (o gatilho por evento de tracking já foi previsto — ADR-0023).
- **Retorno:** Alto.
- **Dependências:** **worker BullMQ dedicado** ativo (hoje inprocess), eventos de tracking → fila.
- **Prioridade:** Próximo Sprint.

### 1.3 Previsão de atrasos (alerta antes de acontecer)
- **Problema:** o atraso só é percebido depois que já aconteceu.
- **Empresas:** agir preventivamente (avisar cliente, remanejar).
- **Motoristas:** aviso de que a próxima janela está em risco.
- **Diferencial:** combina com o CX do destinatário (§3/§6) — "seu pacote vai atrasar 20 min" automático.
- **Dificuldade:** Médio (deriva do modelo de ETA de 1.1).
- **Retorno:** Alto.
- **Dependências:** 1.1 + notificações.
- **Prioridade:** Futuro (depois do baseline de ETA).

### 1.4 Agrupamento inteligente (clustering de entregas)
- **Problema:** entregas próximas não são agrupadas por afinidade (zona, janela, tipo de veículo).
- **Empresas:** menos km, mais entregas por rota.
- **Motoristas:** rotas mais densas = mais ganho por hora rodada.
- **Diferencial:** o cache de matriz por geohash já preparado reduz custo de cálculo.
- **Dificuldade:** Médio.
- **Retorno:** Médio-Alto (impacto direto em custo/entrega).
- **Dependências:** motor de otimização (existe); provedor de matriz.
- **Prioridade:** Futuro.

### 1.5 Assistente operacional (linguagem natural)
- **Problema:** o motorista já tem voz (STT/TTS), mas ela não age sobre a operação; a empresa não conversa com os dados.
- **Empresas:** "quais rotas estão atrasadas agora?" em linguagem natural sobre os read models.
- **Motoristas:** "marquei entregue, próxima parada" sem tocar na tela dirigindo (segurança).
- **Diferencial:** UX de assistente real, não chatbot decorativo. Reusa o assistente de voz já existente.
- **Dificuldade:** Médio (base de voz pronta; falta orquestração de intents→ações).
- **Retorno:** Médio (encanta, diferencia; ROI indireto).
- **Prioridade:** Futuro.

---

## 2. Experiência do Motorista

> O app do motorista já é a peça mais bem-feita do produto. A evolução aqui é **fechar
> o ciclo** (hoje ele não recebe entregas) e depois refinar produtividade.

### 2.1 Fechar o ciclo do motorista autônomo (importar→otimizar→POD)
- **Problema:** o motorista tem um painel excelente que nunca recebe uma entrega.
- **Empresas:** N/A (é o segmento autônomo).
- **Motoristas:** passa a operar sozinho, ponta a ponta.
- **Diferencial:** Circuit/OptimoRoute dominam o autônomo; sem isto a Navix não compete nesse nicho.
- **Dificuldade:** Baixo (backend já aceita `driver`; ver `docs/sprints/sprint-motorista-autonomo.md`).
- **Retorno:** Alto (destrava um segmento inteiro + valida o R2).
- **Dependências:** nenhuma no backend.
- **Prioridade:** **Agora**.

### 2.2 Automações de status (chegada/partida automáticas por geofence)
- **Problema:** o motorista marca status manualmente; esquece, erra.
- **Empresas:** dados de operação mais fiéis, sem trabalho do motorista.
- **Motoristas:** menos toques; foco em dirigir.
- **Diferencial:** o `dwell`/detecção de parada já existe no app — dá para promover a automação.
- **Dificuldade:** Médio.
- **Retorno:** Médio.
- **Prioridade:** Futuro.

### 2.3 Navegação turn-by-turn integrada (deep link + retorno de contexto)
- **Problema:** navegar exige sair do app para o Maps e perder o contexto da rota.
- **Motoristas:** menos fricção entre paradas.
- **Diferencial:** paridade esperada; base de deep link já prevista na arquitetura.
- **Dificuldade:** Baixo-Médio.
- **Retorno:** Médio.
- **Prioridade:** Próximo Sprint.

### 2.4 Produtividade & Gamificação (ganhos, streaks, metas)
- **Problema:** o autônomo não enxerga seu desempenho/ganho consolidado.
- **Motoristas:** engajamento e retenção; senso de progresso.
- **Empresas:** para frotas, ranking saudável de eficiência.
- **Diferencial:** retenção de motorista é o calcanhar de todo player; poucos fazem bem.
- **Dificuldade:** Médio.
- **Retorno:** Médio (retenção).
- **Prioridade:** Futuro. **Cuidado ético:** gamificar sem incentivar direção perigosa ou jornada excessiva.

---

## 3. Experiência da Empresa

### 3.1 CX do destinatário como produto da empresa (rastreamento público + notificação)
- **Problema:** o consumidor final não tem link de rastreio, ETA nem aviso. **É a maior lacuna competitiva.**
- **Empresas:** canal de aquisição orgânica (cada destinatário vê a marca) + menos "cadê meu pedido?".
- **Motoristas:** menos ligações e cobranças durante a rota.
- **Diferencial:** é o principal motor de crescimento de Onfleet/Bringg. **Sem isso, a Navix compete com uma mão nas costas.**
- **Dificuldade:** Médio (page pública `track.navix.pt` já reservada; precisa de token de rastreio + webhook/push).
- **Retorno:** **Muito Alto** (produto + growth loop).
- **Dependências:** notificações (SMS/WhatsApp/e-mail), ETA de 1.1 para qualidade.
- **Prioridade:** **Agora/Próximo Sprint** (é o item de maior ROI competitivo do documento).

### 3.2 Dashboards por read model (CQRS) e KPIs de eficiência
- **Problema:** relatórios saem das tabelas transacionais; não escala nem historiza bem.
- **Empresas:** km economizado, custo/entrega, taxa de sucesso, on-time %.
- **Diferencial:** métricas que justificam a assinatura ("provamos que economizamos X").
- **Dificuldade:** Médio-Alto (CQRS — ADR-0011).
- **Retorno:** Alto (é o argumento de renovação).
- **Dependências:** TimescaleDB + read models.
- **Prioridade:** Próximo Sprint.

### 3.3 Alertas inteligentes (não só reativos)
- **Problema:** a empresa descobre o problema tarde.
- **Empresas:** "rota X vai estourar o SLA", "motorista parado há 30 min".
- **Diferencial:** liga o modelo de atraso (1.3) à operação.
- **Dificuldade:** Médio.
- **Retorno:** Médio-Alto.
- **Dependências:** 1.3 + canais de notificação.
- **Prioridade:** Futuro.

### 3.4 Gestão operacional multi-usuário (convite de motorista, papéis)
- **Problema:** hoje a empresa não convida motoristas nem gerencia equipe de verdade.
- **Empresas:** é o pré-requisito do B2B com frota.
- **Diferencial:** destrava o segmento empresa-com-frota (o de maior ticket).
- **Dificuldade:** Médio (RBAC existe; falta convite + vínculo de tenant).
- **Retorno:** Alto (abre o mercado enterprise).
- **Prioridade:** Próximo Sprint (a sprint seguinte ao ciclo do autônomo).

---

## 4. Monetização

> Regra do conselho: **cobrar pelo valor que só a Navix cria** (economia comprovada e
> inteligência), não por assento genérico.

### 4.1 Planos SaaS por valor (autônomo self-service · frota · enterprise)
- **Problema:** sem modelo de preço não há receita previsível (auditoria: nota 4 em custos).
- **Diferencial:** tier do autônomo (baixo atrito, cartão) financia a coleta de dados do flywheel.
- **Dificuldade:** Médio (billing/self-service — Fase 4 do roadmap).
- **Retorno:** Alto (é a receita).
- **Dependências:** `docs/infrastructure/custo-por-tenant.md` + teste de carga (para margem).
- **Prioridade:** Próximo Sprint (definir preço) / Futuro (self-service completo).

### 4.2 Premium: reotimização em tempo real + IA preditiva + CX do destinatário
- **Diferencial:** empacota exatamente os itens de maior valor percebido (1.2, 1.3, 3.1) como upsell.
- **Dificuldade:** Baixo (feature flags por plano).
- **Retorno:** Alto (expansão de receita por conta).
- **Prioridade:** Futuro (após as features existirem).

### 4.3 API pública + Webhooks (integração como produto)
- **Problema:** clientes querem plugar a Navix no ERP/e-commerce deles.
- **Diferencial:** vira plataforma, não app; efeito de lock-in por integração.
- **Dificuldade:** Médio (API já é versionada e contratada; falta chave de API pública, quotas, docs).
- **Retorno:** Médio-Alto.
- **Prioridade:** Futuro.

### 4.4 White-label / Enterprise (domínio próprio, marca, SSO)
- **Diferencial:** o multi-tenant com subdomínio (`*.navix.pt`) já está previsto — base pronta.
- **Dificuldade:** Alto (SSO/SAML, isolamento reforçado, SLA).
- **Retorno:** Alto (ticket grande, poucos logos).
- **Prioridade:** Futuro.

### 4.5 Marketplace (capacidade ociosa / motoristas autônomos ↔ empresas)
- **Problema/oportunidade:** conectar empresas com picos a autônomos ociosos.
- **Diferencial:** vira rede de dois lados — o fosso mais forte que existe (Uber Freight joga aqui).
- **Dificuldade:** Alto (é quase um produto novo: matching, pagamento, confiança).
- **Retorno:** Potencialmente transformador, mas especulativo.
- **Prioridade:** Futuro (só após densidade de oferta e demanda).

---

## 5. Escalabilidade

> A auditoria foi clara: a engenharia de aplicação é forte; a **operação** é o gargalo.
> Sem isto, nada acima aguenta os "milhares de clientes".

### 5.1 Fechar o R2 (IaC + CD + backup testado + teste de carga)
- **Problema:** deploy manual, sem DR, capacidade nunca medida.
- **Diferencial:** pré-requisito de qualquer SLA comercial.
- **Dificuldade:** Médio (Terraform e runbook já escritos em `docs/infrastructure/`).
- **Retorno:** Alto (destrava GA e vendas enterprise).
- **Prioridade:** **Agora** (paralelo às features).

### 5.2 Worker dedicado + fila durável (BullMQ) e read models
- **Problema:** otimização inprocess degrada a API sob carga (R3 da auditoria).
- **Dificuldade:** Baixo (blueprint `navix-worker` já pronto; virar `bullmq`).
- **Retorno:** Alto (habilita reotimização em tempo real e escala independente).
- **Prioridade:** Próximo Sprint.

### 5.3 Observabilidade acionável (alertas ligados a on-call)
- **Estado:** métricas/tracing existem; alertas Prometheus já entraram (ADR-0057). Falta rota para on-call.
- **Dificuldade:** Baixo-Médio.
- **Retorno:** Médio (confiabilidade percebida).
- **Prioridade:** Próximo Sprint.

### 5.4 Segurança contínua (rate limit/captcha no registro, WAF, rotação de chaves)
- **Estado:** RLS forte, cookies HttpOnly, URLs assinadas já feitos. Faltam captcha no registro e WAF de borda.
- **Dificuldade:** Baixo-Médio.
- **Retorno:** Médio (reduz risco; exigência enterprise).
- **Prioridade:** Próximo Sprint.

### 5.5 Multi-região (residência de dados por tenant)
- **Estado:** hoje região única UE (Frankfurt), correto para o piloto PT+BR.
- **Diferencial:** exigência para escalar Brasil + Europa com performance e compliance.
- **Dificuldade:** Alto (Fase 4 do roadmap; tenant-pinning por região).
- **Retorno:** Alto no longo prazo.
- **Prioridade:** Futuro.

---

## 6. Diferenciais Competitivos

> Comparação de **posicionamento** (valide números/planos antes de usar em vendas — o
> mercado muda). O objetivo é achar o espaço onde a Navix pode ser **superior**, não
> empatar.

| Player | Força principal | Onde a Navix pode superar |
|--------|-----------------|---------------------------|
| **Onfleet** | CX do destinatário + operação polida | Igualar o CX **e** somar IA que aprende por tenant (eles não têm o flywheel coletivo) |
| **Circuit** | Simplicidade brutal para autônomo | Navix = mesma simplicidade **+** ponte para virar empresa sem trocar de ferramenta |
| **Routific** | Otimização boa, foco PME | ETA que aprende + tempo real; Routific é mais estático |
| **OptimoRoute** | Otimização robusta | Reotimização dinâmica + CX do destinatário integrados |
| **Bringg** | Enterprise, orquestração ampla | Custo/simplicidade e IA nativa; Bringg é pesado e caro |
| **Uber Freight** | Rede de dois lados (marketplace) | Não competir de frente; o marketplace da Navix (§4.5) seria last-mile, não long-haul |

**A jogada de posicionamento (recomendação do conselho):**
A Navix não vence sendo "mais um roteirizador". Vence sendo **a única plataforma last-mile
que (1) leva o autônomo até virar empresa na mesma ferramenta, (2) tem CX do destinatário
de primeira linha, e (3) tem inteligência que melhora sozinha por operação** — o flywheel
coletivo que a auditoria identificou como o fosso real. Os três juntos são difíceis de
copiar; qualquer um isolado, não.

---

## 7. Roadmap 12 meses (por trimestre)

> Sequenciado por **impacto ÷ esforço** e por dependências. "Agora" pressupõe fechar o
> R2 operacional em paralelo — sem isso, features boas não sobrevivem à escala.

### T1 (0–3 meses) — Provar o ciclo e destravar a base
- **Fechar o ciclo do motorista autônomo** (2.1) — *Agora*
- **Fechar o R2 operacional** (5.1) + **worker dedicado/BullMQ** (5.2)
- **Definição de planos SaaS e modelo de custo** (4.1 — a parte de preço)
- **Início do CX do destinatário** (3.1): rastreamento público + ETA básico
- *Meta:* vídeo do ciclo completo ponta a ponta + primeiro SLA sustentável.

### T2 (3–6 meses) — Tempo real e o motor de crescimento
- **Reotimização dinâmica em tempo real** (1.2)
- **CX do destinatário completo** (3.1): notificações (WhatsApp/SMS/e-mail) + growth loop
- **Convite de motorista / multi-usuário** (3.4) → abre o B2B com frota
- **Observabilidade acionável + segurança** (5.3, 5.4)
- *Meta:* Navix atinge paridade competitiva com Onfleet no CX e supera em IA nativa.

### T3 (6–9 meses) — Inteligência que aprende
- **Modelo real de ETA/tempo de parada** (1.1) substitui a heurística
- **Previsão de atrasos + alertas inteligentes** (1.3, 3.3)
- **Dashboards por read model / KPIs de eficiência** (3.2)
- **Premium empacotado** (4.2) — monetiza tempo real + IA + CX
- *Meta:* o flywheel começa a gerar vantagem mensurável (ETA supera baseline).

### T4 (9–12 meses) — Plataforma e escala
- **API pública + Webhooks** (4.3)
- **Agrupamento inteligente** (1.4) + **navegação integrada** (2.3) + **automações** (2.2)
- **White-label / Enterprise** (4.4) e preparação de **multi-região** (5.5)
- **Gamificação/produtividade do motorista** (2.4)
- *Meta:* Navix vira plataforma integrável e pronta para logos enterprise e 2ª região.

**Fora do horizonte 12m (vigiar, não construir):** Marketplace de dois lados (4.5) —
só quando houver densidade real de oferta e demanda; construir cedo é queimar caixa.

---

## 8. As três coisas, se só houvesse três

1. **CX do destinatário** (3.1) — o maior ROI competitivo e o motor de aquisição orgânica.
2. **Ligar o flywheel de IA** (1.1) — o único ativo que melhora sozinho e não se compra.
3. **Fechar a operação (R2)** (5.1) — sem isso, os dois de cima não sobrevivem à escala.

Tudo o mais é otimização em cima destes três eixos.
