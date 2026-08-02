# API pública e webhooks

> **Versão:** v1 · **Base:** `/api/v1/public` · **ADR:** 0094

A camada pública expõe integrações sem reutilizar o JWT de usuários e sem
duplicar regras de negócio. Todos os dados continuam passando pelos mesmos casos
de uso e pela RLS do tenant.

## Chaves de API

Um administrador cria e revoga chaves com JWT:

```http
POST   /api/v1/integrations/api-keys
GET    /api/v1/integrations/api-keys
DELETE /api/v1/integrations/api-keys/{id}
```

O valor `nvx_live_...` só aparece na resposta de criação. O banco guarda apenas
SHA-256 e um prefixo de identificação. Envie a chave em `X-Api-Key` (preferido)
ou `Authorization: Bearer`. Cada chave possui quota por minuto e um conjunto de
escopos:

| Escopo             | Permissão                         |
| ------------------ | --------------------------------- |
| `deliveries:read`  | listar e consultar entregas       |
| `deliveries:write` | criar, atualizar e alterar status |
| `pod:read`         | consultar comprovante por entrega |
| `eta:read`         | consultar a chegada estimada      |

Endpoints:

```http
GET    /api/v1/public/deliveries
POST   /api/v1/public/deliveries
GET    /api/v1/public/deliveries/{id}
PATCH  /api/v1/public/deliveries/{id}
PATCH  /api/v1/public/deliveries/{id}/status
GET    /api/v1/public/pod/{deliveryId}
GET    /api/v1/public/eta/{deliveryId}
```

As coleções usam a paginação e os filtros documentados em [api.md](./api.md).
Respostas incluem `RateLimit-Limit`, `RateLimit-Remaining` e `RateLimit-Reset`;
quota esgotada retorna `429`.

## Webhooks de saída

Um administrador gerencia assinaturas com JWT:

```http
POST   /api/v1/integrations/webhooks
GET    /api/v1/integrations/webhooks
PATCH  /api/v1/integrations/webhooks/{id}
DELETE /api/v1/integrations/webhooks/{id}
```

Eventos disponíveis: `delivery.created`, `delivery.updated`, `pod.submitted` e
`eta.updated`. O destino precisa ser HTTPS público. Localhost, IP literal,
credenciais na URL e redes privadas são rejeitados; o DNS é conferido novamente
antes de cada envio para reduzir SSRF/rebinding.

O segredo `whsec_...` só aparece na criação e fica cifrado em repouso com
AES-256-GCM. Cada POST contém:

```json
{
  "id": "uuid-da-entrega-do-webhook",
  "type": "delivery.updated",
  "createdAt": "2026-08-02T12:00:00.000Z",
  "data": {}
}
```

Headers de verificação:

```text
X-Navix-Event: delivery.updated
X-Navix-Delivery: <uuid>
X-Navix-Timestamp: <unix-seconds>
X-Navix-Signature: v1=<hex>
```

Verifique `HMAC-SHA256(secret, timestamp + "." + rawBody)` com comparação em
tempo constante e rejeite timestamps antigos. Responda `2xx` em até 10 segundos.
Falhas recebem até seis tentativas com backoff exponencial; depois ficam em
dead-letter para diagnóstico, sem bloquear a operação que originou o evento.
