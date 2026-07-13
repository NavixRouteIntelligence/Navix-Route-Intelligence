# Navix — Melhorias para a versão Beta

> Estado atual: **MVP do frontend concluído**. Esta lista prioriza o que agrega
> mais valor rumo ao Beta, separando o que hoje é honestamente um limite de
> escopo do que é evolução natural.

## 1. Backend / dados (destravam experiências já esboçadas)

1. **Convite de motorista pela Empresa** (usuário `driver` dentro do tenant da empresa). Destrava a visão de frota do Tracking com múltiplos motoristas reais e o vínculo entrega↔motorista.
2. **Criação/edição de entregas pelo Motorista Autônomo** (hoje restrito a admin/dispatcher). Fecha o ciclo de entrada sem depender de importação.
3. **Persistência de preferências no servidor** (tema, idioma, custos de rota) por usuário — hoje é client-side (`localStorage`).
4. **Endpoint de organização** (nome/plano/config da empresa) para tornar a aba Empresa editável.
5. **Ações de entrega com escopo de motorista** (iniciar/concluir/reportar) — hoje as ações rápidas do painel são de UI.

## 2. Otimização e IA

6. **Fatores em tempo real**: trânsito, acidentes e estradas fechadas como provedores plugáveis do custo/roteamento (arquitetura já preparada).
7. **ETA dinâmico e recálculo automático** disparado por eventos de tracking (posição/atraso), não só manual.
8. **AI Insights com modelo real** (previsão de atrasos, sugestão de janelas), substituindo as heurísticas atuais sem mudar a UI.
9. **Portagens automáticas** por rota (integração), além do custo configurável atual.

## 3. Tempo real e PWA

10. ✅ **SSE** no lugar do polling do Tracking (feito — ADR-0018; polling só como fallback). Dashboard e demais telas podem migrar reusando o `RealtimeProvider`.
11. **PWA offline-first**: precache de rotas/assets, sincronização em background e ícones PNG maskable dedicados (hoje SVG + network-first).
12. **Notificações push** (web push) para eventos de rota/entrega.

## 4. UX/UI e qualidade

13. **i18n completo**: traduzir todas as telas (hoje a base cobre shell, perfil, estados e sistema) e formatação de números/moeda por locale.
14. **Testes E2E** (Playwright) dos fluxos críticos: registro por perfil, importação→otimização, tracking.
15. **Auditoria de acessibilidade** com axe/Lighthouse e metas WCAG AA documentadas.
16. **Telemetria de erros** (ex.: Sentry) ligada ao `error.tsx` e ao logger do SW.
17. **Skeletons/empty/error states** revisados tela a tela para consistência total.
18. **Orçamento de performance** (Lighthouse CI) e code-splitting adicional por rota.

## 5. Segurança e operação

19. **Login sem Tenant ID manual** (resolução por e-mail/subdomínio).
20. **Refresh token httpOnly cookie** em vez de `localStorage` (mitiga XSS).
21. **Rate limiting e captcha** no registro/login.

---

_Prioridade sugerida para o Beta: 1, 2, 10, 13, 14 primeiro (destravam valor e qualidade), depois 6–9 (inteligência) e 19–20 (segurança)._
