# Visão — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.2 · **Atualizado:** 2026-07-05

## 1. Missão

Tornar a logística de última milha mais inteligente, econômica e sustentável em qualquer lugar do mundo, colocando otimização de rotas baseada em IA ao alcance desde o motorista autônomo até grandes operações de frota.

## 2. Visão de longo prazo

Ser a camada de inteligência logística padrão do mercado global de última milha — um sistema que planeja, monitora e reotimiza rotas em tempo real e que aprende continuamente com cada entrega para ficar mais eficiente a cada dia.

## 3. Problema

A última milha representa a fatia mais cara e ineficiente da cadeia logística:

- Rotas planejadas manualmente ou com ferramentas estáticas ignoram trânsito, janelas de entrega e imprevistos em tempo real.
- Quilômetros ociosos elevam custo de combustível, emissões de CO₂ e tempo de entrega.
- Pequenos operadores não têm acesso a tecnologia de otimização de nível enterprise.
- Falta de dados e de aprendizado contínuo impede ganhos de eficiência ao longo do tempo.

## 4. Solução

Uma plataforma **SaaS multi-tenant** que combina:

- **Otimização de rotas** com algoritmos de VRP (Vehicle Routing Problem) e restrições reais (janelas de tempo, capacidade, habilidades, prioridade).
- **Dados em tempo real** (trânsito, clima, eventos) para reotimização dinâmica durante a operação.
- **Machine Learning** para prever ETAs, tempos de parada e comportamento de demanda a partir do histórico de cada tenant.
- **Aprendizado contínuo**: cada entrega realimenta os modelos, aumentando a precisão e a eficiência ao longo do tempo.

### Proposta de valor

- Redução de quilômetros percorridos, consumo de combustível e tempo de entrega.
- Aumento da densidade de entregas por rota e da taxa de entregas no prazo.
- Sustentabilidade: menos emissões por entrega.
- Acessível a qualquer porte de operação, em qualquer país.
- Experiência do cliente final (B2B2C): notificações de ETA e atualizações de entrega (a partir da Fase 2).

## 5. Mercado

- **TAM:** mercado global de software de gestão de última milha e otimização de rotas.
- **SAM:** operações de entrega urbana em regiões com dados de mapas/trânsito disponíveis.
- **SOM inicial:** PMEs de logística e frotas de médio porte em mercados-alvo iniciais.

> _A ser detalhado com pesquisa de mercado e dados quantitativos (TAM/SAM/SOM) em fase de validação._

## 6. Personas

| Persona | Perfil | Dor principal | Como a Navix ajuda |
|---------|--------|---------------|--------------------|
| **Operador de frota** | Gestor logístico de empresa média/grande | Custo alto e baixa previsibilidade | Otimização automática e reotimização em tempo real |
| **Despachante** | Responsável por montar rotas diárias | Processo manual e demorado | Planejamento automático com restrições |
| **Motorista** | Executor das entregas | Rotas ruins, retrabalho | App com sequência otimizada e navegação |
| **Motorista autônomo / MEI** | Operação individual | Sem acesso a tecnologia enterprise | Plano acessível e self-service |
| **Administrador do tenant** | Dono da conta da empresa | Governança, usuários e dados | Gestão multiusuário, papéis e relatórios |

## 7. Diferenciais

- Reotimização **dinâmica** em tempo real, não apenas planejamento estático.
- **Aprendizado contínuo** por tenant (modelos que melhoram com o uso).
- Arquitetura **multi-tenant global** — pronta para múltiplos países, idiomas e moedas.
- **Segurança e privacidade** como pilar (ver [security.md](./security.md)).

## 8. Princípios de produto

1. **Eficiência mensurável** — toda feature deve mover uma métrica de eficiência.
2. **Time-to-value curto** — o usuário obtém rotas úteis já no primeiro uso.
3. **Confiança** — dados sensíveis protegidos e decisões explicáveis.
4. **Escala global desde o início** — internacionalização e multi-tenancy não são retrofit.

## 9. Métricas de sucesso (North Star & KPIs)

- **North Star:** entregas otimizadas concluídas por período.
- **Eficiência:** % de redução de km rodados e de combustível vs. baseline do tenant.
- **Qualidade:** taxa de entregas no prazo (on-time delivery).
- **Produto:** tempo até primeira rota otimizada, adoção de reotimização em tempo real.
- **Negócio:** MRR, churn, NRR, CAC/LTV.
- **Confiabilidade:** uptime, latência de otimização, precisão de ETA (MAE) — formalizados como **SLOs/error budgets** ([roadmap.md](./roadmap.md)).

> **Metas de escala (design target):** a arquitetura é desenhada para milhares de tenants e milhões de entregas/dia sem reescrita (ver [architecture.md](./architecture.md) §12).

## 10. Fora de escopo (por enquanto)

- Middle-mile / long-haul e gestão de armazém (WMS).
- Marketplace de entregadores.
- Hardware/telemática proprietária.

## 11. Riscos e hipóteses

- Disponibilidade e custo de dados de mapas/trânsito por região.
- Qualidade dos dados de entrada fornecidos pelos tenants.
- Complexidade computacional do VRP em grande escala.
- Conformidade regulatória (privacidade) em múltiplas jurisdições.

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial |
| 2026-07-05 | 0.2 | CTO | B2B2C (notificações ao cliente final), SLOs, metas de escala |
