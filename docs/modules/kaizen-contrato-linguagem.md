# Contrato de linguagem do Kaizen — resumo diário do motorista (pt-PT)

> **Estado: proposto, a aguardar aprovação.** Nada disto está implementado.
> A decisão técnica que o sustenta é a ADR-0116 em [decisions.md](../decisions.md).

Este documento fixa **o que o resumo diário pode dizer**, com que palavras, e o
que nunca pode dizer. Vale para a app do motorista em `pt_PT`
(`apps/mobile/lib/l10n/arb/app_pt_PT.arb`).

O destinatário é o **motorista autónomo**: trabalha por conta própria, não tem
chefe a ler isto, e não há ninguém a quem comparar. Um resumo que soe a
avaliação de desempenho está errado por construção — não existe avaliador.

---

## 1. O que o resumo é

Quatro blocos, por esta ordem, uma vez por dia:

1. **O que aconteceu ontem** — factos contados, nunca estimados.
2. **Comparação consigo próprio** — ontem contra a mediana das últimas quatro
   semanas do mesmo dia da semana. Nunca contra outra pessoa.
3. **Explicação** — por que é que o número foi aquele, quando se sabe. Quando
   não se sabe, não há explicação (e não há palpite).
4. **Uma ação para hoje** — uma só, opcional, recusável.

Se não houver dados suficientes para um bloco, **o bloco não aparece**. Não há
placeholder, não há "0", não há "sem dados disponíveis" repetido quatro vezes.

---

## 2. Vocabulário obrigatório

| Conceito                                    | Diz-se                               | Nunca se diz                                      |
| ------------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| Entregas concluídas                         | «entregas concluídas»                | «produtividade», «output», «volume»               |
| Entregas não concluídas                     | «entregas por concluir»              | «falhas», «insucessos», «perdas»                  |
| Dentro da janela combinada                  | «dentro da janela combinada»         | «no prazo», «pontualidade», «SLA»                 |
| Rota calculada                              | «rota sugerida»                      | «rota ideal», «rota certa»                        |
| Diferença face ao plano                     | «diferente do previsto»              | «desvio», «incumprimento»                         |
| Comparação temporal                         | «em relação às suas últimas semanas» | «acima/abaixo da média», «ranking»                |
| Tempo entre a primeira e a última atividade | «período de atividade»               | «horas trabalhadas», «jornada», «tempo produtivo» |

**Tratamento:** segunda pessoa do singular com verbo na terceira («concluiu»,
«teve»), registo pt-PT. Sem imperativo na descrição dos factos. O imperativo só
é admitido na ação sugerida, e sempre com escape («se fizer sentido»).

**Sem exclamação.** Sem emoji de celebração, de alerta ou de fogo. O resumo
informa; não anima nem repreende.

---

## 3. Proibições

Nenhuma destas pode aparecer, em nenhum ecrã, mesmo que o dado exista:

| Proibido                                                        | Porquê                                                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ranking** ou comparação com outros motoristas                 | O destinatário é autónomo. Comparar com desconhecidos é pressão sem utilidade.                                                                       |
| **Velocidade** (média, máxima, pontual)                         | `driver_positions.speed` **existe** e é gravado. Mostrá-lo transforma o resumo num incentivo a correr. A ausência aqui é escolha, não falta de dado. |
| **Entregas por hora** ou qualquer taxa com tempo no denominador | É a definição operacional de «anda mais depressa».                                                                                                   |
| **Meta de volume** («faça 20 hoje»)                             | Meta de volume ignora o que o dia trouxe e pune quem teve um dia difícil. Metas, quando existirem, são de **taxa** e contra o próprio (ADR-0097).    |
| **Culpa** («não cumpriu», «ficou aquém», «devia ter»)           | O resumo não sabe o que aconteceu na rua. Trânsito, cliente ausente e avaria têm o mesmo aspeto nos dados.                                           |
| **Sequência que puna descanso**                                 | Um dia sem trabalhar **não** quebra sequência nenhuma (ADR-0097). Descansar não é falhar.                                                            |
| **Estimativa apresentada como resultado**                       | Ver secção 5.                                                                                                                                        |
| **Notificação fora do horário definido**                        | Um resumo que chega às 23h é uma interrupção, não um resumo.                                                                                         |

---

## 4. Exemplos aprovados

### 4.1 Dia com dados completos

> **Ontem**
> Concluiu 14 entregas. Todas dentro da janela combinada.
>
> **Em relação às suas últimas semanas**
> Nas últimas quatro terças-feiras concluiu 11, 13, 12 e 14. Ontem ficou em
> linha com o habitual.
>
> **Porquê**
> Duas paragens tinham janela a abrir depois das 15h, o que concentrou o
> trabalho na parte final do dia.
>
> **Para hoje**
> Se fizer sentido, comece pelas paragens com janela mais cedo — hoje há três.

### 4.2 Dia com menos entregas do que o habitual

> **Ontem**
> Concluiu 6 entregas. Ficaram 2 por concluir.
>
> **Em relação às suas últimas semanas**
> Nas últimas quatro quartas-feiras concluiu 12, 11, 13 e 10.
>
> **Porquê**
> Não sabemos. As duas por concluir não têm motivo registado.
>
> **Para hoje**
> Nada a sugerir.

Repare no que **não** está lá: nenhuma pergunta sobre o que correu mal, nenhum
«vamos recuperar hoje», nenhum total acumulado da semana a insinuar défice.

### 4.3 Dia sem dados suficientes

> **Ontem**
> Ainda não há histórico suficiente para comparar. A partir da quarta semana,
> este resumo passa a mostrar a sua evolução.

Um bloco, e mais nada. Não se inventa um resumo de um dia isolado.

### 4.4 Dia de folga

> **Ontem**
> Não registou entregas.

Fim. Sem «que tal recomeçar hoje?», sem sequência interrompida, sem contagem de
dias parados.

---

## 5. A regra da estimativa

O sistema calcula uma **poupança** por rota (`route_plans.savings`). Ela compara
a rota sugerida com a ordem em que as paragens foram enviadas ao otimizador —
é um **contrafactual**, não uma medição. Ninguém conduziu a ordem alternativa.

Também calcula **combustível e CO₂** a partir de constantes por tipo de veículo
(3 l/100 km para mota, 8 para carro…), aplicadas à distância planeada. Nenhum
destes números foi medido no veículo de ninguém.

Por isso:

| Nunca                          | Em vez disso                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| «Poupou 12 km»                 | «A rota sugerida era 12 km mais curta do que a ordem de origem»                                                          |
| «Poupou 4,30 € em combustível» | _(não se diz — não há preço de combustível nem consumo real)_                                                            |
| «Evitou 2,1 kg de CO₂»         | «Estimativa, com base no consumo típico deste tipo de veículo» — e só num ecrã que se abre de propósito, nunca no resumo |

Se a frase não sobrevive à pergunta **«quem mediu isto?»**, não entra no resumo.

---

## 6. Quando o resumo não aparece

- Menos de 3 dias com atividade nas últimas 4 semanas → não há resumo.
- O dia anterior não tem nenhuma entrega finalizada → só o bloco 1 (§4.4).
- A origem do dado é o rollup do tenant e o tenant **não** é de tipo `driver` →
  não há resumo (ver ADR-0116: nesse caso os números podem ser de outra pessoa).
- O fuso horário do motorista é desconhecido → o resumo pode aparecer, mas tem
  de dizer que dia está a resumir («terça-feira, 12 de agosto»), nunca só
  «ontem».

---

## 7. O que falta decidir

- **Hora de envio.** Proposta: entre as 07h00 e as 09h00 no fuso do motorista,
  configurável, com desativação num toque. Não decidido.
- **Canal.** Notificação push, ecrã inicial, ou ambos. Não decidido.
- **Tradução das restantes locales.** Este contrato é `pt_PT`. `pt_BR`, `en` e
  `es` seguem depois, e a tradução não pode reintroduzir o que a §3 proíbe —
  «no prazo» é, em qualquer língua, a porta de entrada da pressão.
