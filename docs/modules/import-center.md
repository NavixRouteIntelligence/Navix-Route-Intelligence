# Import Center — módulo de ingestão de entregas

> **Status:** Implementado (Fase 2) · **Atualizado:** 2026-07-07

Permite importar entregas em massa a partir de arquivos (CSV, XLS/XLSX, PDF), com detecção automática de formato e colunas, validação, geocodificação, classificação de endereço, detecção de duplicados, pré-visualização com resumo e confirmação — integrando automaticamente com **Delivery** e, opcionalmente, com o **Route Optimizer**.

## 1. Fluxo do usuário

1. **Upload** (`/imports`): arrasta ou seleciona um arquivo (até 5 MB).
2. **Pré-visualização**: o backend lê o arquivo, detecta colunas, geocodifica endereços sem coordenadas, classifica o endereço, valida obrigatórios e marca duplicados. A UI mostra 4 cartões de resumo (válidas, inválidas, duplicados, economia estimada) e a tabela de linhas com filtro por status.
3. **Confirmação**: cria as entregas válidas no Delivery; se "Otimizar rota" estiver marcado, dispara o Route Optimizer. O lote passa de `preview` → `imported`.
4. **Histórico e relatório de erros** (`/imports/{id}`): consulta lotes anteriores e exporta os registros inválidos em CSV.

## 2. Arquitetura (Clean Architecture / DDD)

```
modules/import/
├─ domain/
│  ├─ import-batch.ts            # agregado (preview → imported)
│  ├─ import-row.ts             # StoredImportRow (view + resolved + dedupKey)
│  └─ ports/                    # file-parser, geocoder, address-classifier,
│                                 delivery-creator, route-estimator, repository
├─ application/
│  ├─ preview-import.use-case.ts   # parse + geocode + classify + validate + dedup + estimate
│  ├─ confirm-import.use-case.ts   # cria entregas + (opcional) otimiza
│  ├─ get-import / list-imports.use-case.ts
│  ├─ parser-registry.ts / normalize.ts / mappers/
├─ infrastructure/
│  ├─ parsing/                  # csv (papaparse), xlsx (SheetJS), pdf (pdf-parse), column-detection
│  ├─ geocoding/               # mapbox-geocoder
│  ├─ classification/          # heuristic-address-classifier
│  ├─ gateways/                # delivery-creator, route-estimator (anti-corrupção)
│  └─ persistence/             # orm-entity + repository (scoped/RLS)
└─ interface/
   ├─ import.controller.ts      # POST preview (multipart), POST confirm, GET list/detail
   └─ dto/
```

### Integração entre módulos (anti-corrupção)

O Import **não** conhece as entranhas de Delivery/Optimizer. Cada consumidor define a sua própria porta e um gateway adaptador:

- **Delivery** expõe `DELIVERY_WRITER` (`DeliveryWriterService`). Import consome via `DELIVERY_CREATOR` → `DeliveryCreatorGateway`.
- **Optimizer** expõe `OPTIMIZER_SERVICE` (`OptimizerService`, com `estimate` dry-run e `optimizeDeliveries`). Import consome via `ROUTE_ESTIMATOR` → `RouteEstimatorGateway`.

Isso preserva as fronteiras de contexto e mantém o Import desacoplado.

## 3. Regras de negócio

- **Detecção de colunas**: sinônimos pt/en normalizados (sem acento, minúsculo). Aceita `lat`/`lng` diretos.
- **Validação**: linha é inválida se faltar endereço ou não for possível obter coordenadas.
- **Geocodificação**: só ocorre quando faltam `latitude`/`longitude`. Sem `MAPBOX_TOKEN`, o geocoder retorna `null` e a linha fica inválida (sem coordenadas).
- **Duplicados**: chave = nº da encomenda (se houver) ou `endereço|lat,lng`. Primeira ocorrência é válida; repetições viram `duplicate`.
- **Economia estimada**: calculada por dry-run do otimizador quando há ≥ 2 linhas válidas (sem persistir).
- **PDF**: best-effort — todas as linhas marcadas `lowConfidence`.
- **Limites**: 5 MB por arquivo, 1000 linhas por lote.

## 4. Segurança

- **Multi-tenant**: tabela `import_batches` com RLS `ENABLE` + `FORCE` e policy por `app.current_tenant`; grant restrito ao role `navix_app`.
- **Autorização**: `JwtAuthGuard` + `RolesGuard`, `@Roles('admin','dispatcher')`.
- **Auditoria**: `import.previewed` e `import.confirmed`.
- **Upload**: `file` obrigatório, tamanho limitado no interceptor; tipo derivado da extensão (rejeita formatos não suportados).

## 5. Configuração

| Variável | Descrição |
|----------|-----------|
| `MAPBOX_TOKEN` | Token server-side para geocodificação (opcional; sem ele, linhas sem coordenadas ficam inválidas). |

Dependências adicionadas: `papaparse`, `xlsx`, `pdf-parse`, `multer` (+ tipos).

## 6. Testes

- `column-detection.spec.ts` — mapeamento de colunas (pt/en) e extração de células.
- `heuristic-address-classifier.spec.ts` — classificação por categoria.
- `normalize.spec.ts` — normalização de prioridade e resolução de endereço.
- `preview-import.use-case.spec.ts` — validação, duplicados, geocodificação e estimativa.

## 7. Extensibilidade futura (não implementada)

Parsers são multi-provider (Strategy Pattern). Novas fontes entram adicionando um `FileParser`/adaptador e registrando-o em `import.module.ts`, sem alterar contrato nem casos de uso:

- Marketplaces: Shopee, Amazon, Shopify, WooCommerce.
- APIs externas de pedidos.
- OCR para PDFs escaneados / imagens (substituindo o parser best-effort atual).
