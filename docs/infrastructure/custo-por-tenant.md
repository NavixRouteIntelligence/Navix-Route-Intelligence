# Modelo de Custo por Tenant

> A Auditoria 5 deu nota 4,0 em "Custos operacionais" por não existir modelo de custo
> por cliente. Este documento é o ponto de partida — números a refinar **após o teste
> de carga (R4)**, que é o que revela o consumo real.

## Custo fixo da plataforma (independe do nº de clientes)

| Item (AWS Frankfurt, produção enxuta) | Custo/mês aprox. |
|---------------------------------------|------------------|
| RDS Postgres (db.t4g.medium, Multi-AZ) | €90–130 |
| ElastiCache Redis (2 nós t4g.small) | €35–55 |
| ECS Fargate (api x2, worker x1, web x2) | €70–120 |
| Load balancer (ALB) | €18–25 |
| NAT gateway (produção, 2 AZ) | €60–70 |
| S3 + ECR + Secrets + logs | €10–25 |
| **Total fixo aprox.** | **€280–420** |

> No piloto (Neon+Render+Upstash) esse fixo cai para ~€25–70/mês, ao custo de menos
> robustez — adequado para validar, não para escala.

## Custo variável (cresce com o uso)

Os direcionadores reais de custo por tenant:

1. **Otimizações de rota/dia** → CPU do worker (o item mais caro por operação).
2. **Posições de rastreamento ingeridas** → escrita no Postgres/TimescaleDB + storage.
3. **Chamadas ao provedor de mapas/geocodificação** → custo externo por request
   (mitigado pelo cache de matriz por geohash — já na arquitetura).
4. **Mídia de POD** → armazenamento S3 + transferência.

## Como calcular a margem (fórmula)

```
custo_por_tenant ≈ (custo_fixo / nº_tenants) + custo_variável_do_tenant
margem_bruta     = preço_do_plano − custo_por_tenant
```

Conforme o nº de tenants cresce, a parcela fixa por tenant despenca — é a economia de
escala do SaaS. O objetivo antes do GA é medir o `custo_variável` de um tenant médio
(via teste de carga + tags de custo por serviço) e cravar o preço dos planos
(autônomo x frota) com margem conhecida.

## Ações

- [ ] Ligar **AWS Cost Allocation Tags** por serviço (já há `Project`/`Environment`).
- [ ] Rodar o teste de carga (R4) e medir custo por 1.000 otimizações e por
      1M de posições ingeridas.
- [ ] Definir teto de gasto (billing alarm) por ambiente.
