import type {
  ParkingDifficulty,
  VoiceCommandSlots,
  VoiceCommandView,
  VoiceIntent,
} from '@navix/contracts';

/**
 * Palavras-chave por intenção (PT/EN/ES). Casadas contra a transcrição
 * normalizada. Ordem importa: a primeira intenção com match vence, então as mais
 * específicas vêm antes das genéricas (`help` por último antes de `unknown`).
 */
const KEYWORDS: { intent: Exclude<VoiceIntent, 'unknown'>; terms: string[] }[] = [
  {
    intent: 'mark_delivered',
    terms: ['entregue', 'entreguei', 'concluir entrega', 'delivered', 'mark delivered', 'entregado', 'entregue ya'],
  },
  {
    intent: 'report_parking',
    terms: ['estacionamento', 'vaga', 'estacionar', 'parking', 'aparcamiento', 'aparcar', 'sem vaga', 'no parking'],
  },
  {
    intent: 'next_stop',
    terms: ['proxima parada', 'proxima entrega', 'proximo', 'next stop', 'next delivery', 'proxima parada', 'siguiente parada', 'siguiente'],
  },
  {
    intent: 'remaining',
    terms: ['quanto falta', 'quanto tempo', 'falta', 'how long', 'time left', 'remaining', 'cuanto falta', 'cuanto tiempo'],
  },
  {
    intent: 'route_summary',
    terms: ['resumo', 'como esta a rota', 'status da rota', 'route summary', 'summary', 'resumen', 'como va la ruta'],
  },
  {
    intent: 'help',
    terms: ['ajuda', 'o que posso', 'comandos', 'help', 'what can i', 'ayuda', 'que puedo'],
  },
];

/** Remove acentos e baixa a caixa para casar palavras-chave de forma robusta. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectParkingDifficulty(text: string): ParkingDifficulty | undefined {
  if (/(dificil|hard|complicad|dificultad|sem vaga|no parking|lotad)/.test(text)) return 'hard';
  if (/(moderad|medio|medium|regular)/.test(text)) return 'moderate';
  if (/(facil|easy|tranquil|livre|vazio)/.test(text)) return 'easy';
  return undefined;
}

/**
 * Interpreta um comando de voz do motorista (ADR-0032). Função **pura** e
 * determinística; um modelo de NLU/LLM pode substituí-la atrás da
 * `VoiceCommandInterpreterPort` sem tocar consumidores. Não executa ações — só
 * classifica a intenção e extrai parâmetros; a resposta falada é montada no web.
 */
export function interpretVoiceCommand(transcript: string, _locale?: string): VoiceCommandView {
  const text = normalize(transcript);
  if (!text) return { intent: 'unknown', confidence: 0, slots: {} };

  for (const { intent, terms } of KEYWORDS) {
    const matched = terms.filter((t) => text.includes(normalize(t)));
    if (matched.length === 0) continue;

    const slots: VoiceCommandSlots = {};
    if (intent === 'report_parking') {
      const difficulty = detectParkingDifficulty(text);
      if (difficulty) slots.parkingDifficulty = difficulty;
    }
    // Confiança pela força do match (nº de termos e comprimento relativo).
    const confidence = Math.min(0.95, 0.55 + matched.length * 0.2);
    return { intent, confidence: Math.round(confidence * 100) / 100, slots };
  }

  return { intent: 'unknown', confidence: 0, slots: {} };
}
