# Mapa da rota — wireframe e estados (MVP)

> **Estado: proposto, a aguardar aprovação.** Nada disto está implementado.
> A decisão técnica que o sustenta é a ADR-0125 em [decisions.md](../decisions.md).

O mapa entra na **Minha Rota**, entre o resumo e a lista de paradas. Não é uma
tela nova: quem abre a app quer a rota, e um separador só para o mapa faria a
pessoa escolher entre ver onde é e ver o que fazer.

---

## 1. Recolhido (estado inicial)

```
┌─────────────────────────────────────────┐
│  Minha Rota                             │
├─────────────────────────────────────────┤
│  ⚠ 1 entrega fora da rota (capacidade)  │  ← avisos existentes, acima
├─────────────────────────────────────────┤
│  12 paradas · 38 km · 4h20              │  ← resumo existente
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │            [ mapa 180 dp ]          │ │  ← recolhido
│ │        ③ ④                          │ │
│ │     ②      ⑤   ⑥                    │ │
│ │  ●①                    ⑦            │ │
│ │  ▲ você                             │ │
│ │                          ⤢ expandir │ │
│ └─────────────────────────────────────┘ │
│  Próxima: ① Rua das Flores, 12          │  ← fora do mapa, sempre legível
├─────────────────────────────────────────┤
│  ▸ O seu dia de ontem                   │
│  ▸ Desempenho                           │
│  ─────────────────────────────────────  │
│  Paradas                                │
│  ① Rua das Flores, 12      [Navegar]    │
│  ② …                                    │
└─────────────────────────────────────────┘
```

**180 dp** é altura suficiente para situar a rota e insuficiente para tentar
navegar por ela — o que é intencional. Navegar é no Google/Apple Maps.

## 2. Expandido

```
┌─────────────────────────────────────────┐
│  ✕                          Rota de hoje │
├─────────────────────────────────────────┤
│                                         │
│              ③ ④                        │
│           ②      ⑤   ⑥                  │
│        ●①                  ⑦            │
│        ▲ você                           │
│                                         │
│                              ⌖ centrar  │
│                                         │
├─────────────────────────────────────────┤
│  ① Rua das Flores, 12                   │  ← cartão da parada tocada
│  Janela 09:00–12:00 · pendente          │
│  [ Navegar ]            [ Ver detalhe ] │
└─────────────────────────────────────────┘
```

O expandido cobre a tela e tem **fecho explícito**. Não há gesto que expanda
sem querer: o mapa recolhido rola com a página, e só o botão `⤢` expande.

---

## 3. Estados visuais das paradas

| Estado              | Marcador                                                     | Porquê assim                                                                                                                            |
| ------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Próxima**         | Círculo cheio, cor primária, número branco, **anel** à volta | É a única que a pessoa precisa de encontrar num relance. O anel distingue-a sem depender de cor, para quem não distingue as duas cores. |
| **Pendente**        | Círculo cheio, cor neutra escura, número branco              | O estado normal. Não compete com a próxima.                                                                                             |
| **Concluída**       | Círculo **vazado**, contorno neutro, ✓ no lugar do número    | Vazado porque já não é destino. O número sai: a sequência dela deixou de importar.                                                      |
| **Falhada**         | Círculo vazado, contorno de aviso, **!** no lugar do número  | Aviso, não erro: a cor de aviso é a mesma do banner de rota parcial. Nunca vermelho de erro — não foi a pessoa que falhou.              |
| **Sem coordenadas** | **Não aparece no mapa**                                      | Ver §4.                                                                                                                                 |

A posição do motorista é um **triângulo** orientado, nunca um número: não é uma
parada, e desenhá-la como uma confundiria a contagem.

## 4. Paradas sem coordenadas

Não são desenhadas — não há onde. E não desaparecem: acima do mapa, uma linha
diz quantas ficaram de fora, com a mesma linguagem dos avisos existentes.

```
┌─────────────────────────────────────────┐
│  2 paradas sem morada localizável       │
│  Aparecem na lista, mas não no mapa.    │
└─────────────────────────────────────────┘
```

Inventar uma posição — o centro da cidade, a média das outras — seria pôr um
ponto onde não há entrega. É a mesma regra do resto do produto: ausência
declarada, nunca preenchida com o plausível.

## 5. Interação

| Ação                    | Resultado                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Tocar num marcador      | Abre o cartão da parada (recolhido: rola até ela na lista; expandido: cartão inferior) |
| Tocar no mapa recolhido | Expande. Um toque, sem gesto ambíguo.                                                  |
| `⌖ centrar`             | Reenquadra em todas as paradas + posição atual                                         |
| Arrastar / _pinch_      | Livre, sem limite mínimo nem máximo artificial                                         |
| Tocar em «Navegar»      | Abre Google/Apple Maps — **o mesmo botão da lista**, não um caminho paralelo           |

**Enquadramento inicial:** todas as paradas com coordenadas mais a posição
atual, com 56 dp de margem. Uma parada só: zoom 14, centrada nela.

**Atualização:** a posição do motorista segue o mesmo fluxo do rastreio que já
existe. As paradas só mudam quando a rota muda — o mapa **não** consulta nada
sozinho, e não há _polling_ próprio.

## 6. Sem mapa

Três razões para não haver mapa, e a mesma tela para as três:

- token do Mapbox ausente,
- falha ao carregar o estilo,
- nenhuma parada com coordenadas.

```
┌─────────────────────────────────────────┐
│  Mapa indisponível                      │
│  A sua rota continua abaixo, na ordem   │
│  sugerida.                              │
└─────────────────────────────────────────┘
```

Sem botão de «tentar de novo» quando a causa é configuração: pedir uma ação que
não pode resultar é a mesma falha que o estado offline do Kaizen evita.

## 7. O que o mapa não faz

- Não reordena paradas. Arrastar um marcador não existe.
- Não muda estado de entrega. Não há «marcar como entregue» no mapa.
- Não abre POD.
- Não dispara otimização.

O mapa é uma **leitura**. Tudo o que altera a rota continua onde já está: a
reorganização na folha própria, o estado na tela da parada, o POD no seu fluxo.
