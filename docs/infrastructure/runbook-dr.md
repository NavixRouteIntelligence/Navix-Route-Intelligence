# Runbook — Backup, Restore e Disaster Recovery

> **O que é:** o plano de continuidade que a Auditoria 5 apontou como ausente
> ("o banco corrompeu às 3h de uma segunda-feira, e agora?"). Parte do R2.
> Mantenha este documento impresso/offline — ele precisa ser útil quando o sistema
> estiver fora do ar.
>
> **Status:** v1 · **Revisar:** a cada trimestre e após qualquer incidente.

---

## 0. Metas (defina e comprometa)

| Métrica | Significado | Meta inicial |
|---------|-------------|--------------|
| **RPO** | Quanto dado no máximo se pode perder | ≤ 5 minutos (via PITR) |
| **RTO** | Em quanto tempo voltamos ao ar | ≤ 1 hora |

> Estas metas só valem quando o **teste de restore** (§4) tiver sido executado com
> sucesso pelo menos uma vez. Até lá, são intenção, não garantia.

---

## 1. O que é feito de backup (e onde)

| Item | Mecanismo | Retenção | Onde |
|------|-----------|----------|------|
| Banco Postgres | Snapshot automático + PITR (RDS) / branch (Neon) | 14 dias | Mesma região (UE) |
| Banco Postgres (cópia fria) | Snapshot manual mensal exportado p/ S3 | 12 meses | S3 com Object Lock |
| Redis | Snapshot diário (ElastiCache) | 7 dias | Mesma região |
| Mídia POD (fotos/assinaturas) | S3 versionado + réplica | Indefinido | S3 |
| Segredos (JWT/KEK) | Secrets Manager + cópia no cofre offline | — | 1Password + papel em cofre físico |
| Infraestrutura | Código Terraform (`infra/terraform/`) | git | GitHub |

> **Regra 3-2-1:** 3 cópias, 2 mídias, 1 fora do local. Falta hoje a cópia
> geográfica separada (a réplica cross-region entra na Fase 4 / multi-região).

---

## 2. Sinais de que estamos num incidente

- Healthcheck `api.<dominio>/api/v1/health` falhando por > 2 min.
- Alertas do Prometheus/Alertmanager (ADR-0057) disparando (erro 5xx, latência, fila).
- Clientes relatando login intermitente (ver R5 — chaves JWT divergentes).

**Primeira ação sempre:** declarar o incidente no canal `#incidentes`, anotar hora de
início e designar **um** responsável (incident commander). Comunicar antes de mexer.

---

## 3. Procedimentos de recuperação

### 3.1 A aplicação caiu (mas o banco está ok)
1. Ver logs no CloudWatch (`/ecs/navix-production`).
2. Causa comum: deploy ruim. **Rollback:** reimplantar a imagem anterior —
   `aws ecs update-service --cluster navix-production --service api --task-definition navix-production-api:<revisão-anterior> --force-new-deployment`.
3. Confirmar estabilização: `aws ecs wait services-stable ...`.

### 3.2 O banco corrompeu / dado apagado por engano
1. **Não** apague nada. Identifique o horário anterior ao problema.
2. **RDS:** "Restore to point in time" para um **novo** instance (nunca por cima do
   atual). Depois aponte a aplicação para o novo endpoint (atualize o secret
   `DATABASE_URL` e reimplante).
3. **Neon:** crie um **branch** a partir do timestamp anterior ao incidente e promova.
4. Valide os dados antes de redirecionar tráfego (§4).

### 3.3 Vazamento/comprometimento de credencial
1. Rotacione o segredo afetado no Secrets Manager.
2. Force logout global (rotacione as chaves JWT — todos os tokens perdem validade).
3. Reveja o `audit_log` (tem RLS — ADR-0054) para escopo do acesso.
4. Cumpra a notificação legal: **GDPR** exige comunicar em até **72h**; a **LGPD** exige
   comunicação à ANPD e aos titulares em prazo razoável. Acione o DPO/jurídico.

### 3.4 A região inteira (Frankfurt) caiu
1. Evento raro. Enquanto multi-região (Fase 4) não existe, o plano é:
   recriar a stack em outra região da UE (ex.: `eu-west-1`) com o mesmo Terraform
   (`aws_region = "eu-west-1"`) e restaurar o último snapshot exportado para o S3.
2. RTO nesse cenário é maior (horas). Documentar como risco aceito do piloto.

---

## 4. Teste de restore (OBRIGATÓRIO antes de prometer RTO/RPO)

Um backup nunca testado não é um backup. Executar **trimestralmente**:

1. Restaurar o último snapshot do banco para um instance **isolado**.
2. Rodar as verificações de integridade (contagem de tenants, entregas, checksum de
   uma amostra).
3. Subir a aplicação apontada para essa cópia e fazer um login + uma entrega de teste.
4. Cronometrar o processo inteiro → esse é o seu **RTO real**. Registrar em §0.
5. Destruir a cópia de teste.

**Registro dos testes:**

| Data | Quem | RTO medido | Resultado | Observações |
|------|------|-----------|-----------|-------------|
| _(preencher no 1º teste)_ | | | | |

---

## 5. On-call e escalonamento

| Nível | Quem | Quando |
|-------|------|--------|
| L1 | Plantonista da semana | Todo alerta |
| L2 | CTO / eng. de infra | L1 não resolveu em 30 min |
| L3 | Fornecedor (AWS Support / Neon) | Falha de plataforma |

Contatos e rodízio: manter em ferramenta de on-call (ex.: PagerDuty/Opsgenie) e uma
cópia offline. Todo incidente gera um **post-mortem sem culpados** em `docs/reviews/`.

---

## 6. Checklist pós-incidente

- [ ] Serviço restabelecido e validado.
- [ ] Causa raiz identificada.
- [ ] Post-mortem escrito e compartilhado.
- [ ] Ação preventiva virou tarefa no backlog.
- [ ] Notificações legais (se houve dado pessoal) cumpridas.
