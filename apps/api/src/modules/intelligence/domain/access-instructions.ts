import type { AccessInstructionKind, AccessInstructionView } from '@navix/contracts';

/**
 * Navegação contextual (ADR-0028): deriva **instruções de acesso ao destino** a
 * partir de observações livres (`delivery.notes`, notas do cliente). Nesta
 * camada, um classificador por palavras-chave; evolui para NLP/LLM atrás da
 * mesma port, sem alterar consumidores. Puro e determinístico.
 */
const RULES: { kind: AccessInstructionKind; re: RegExp }[] = [
  { kind: 'gate_code', re: /\b(c[óo]digo|senha|teclado|code|keypad)\b/i },
  { kind: 'intercom', re: /\b(interfone|campainha|intercom|porteiro eletr)/i },
  { kind: 'dock', re: /\b(doca|dock|plataforma|carga e descarga|p[áa]tio)\b/i },
  { kind: 'reception', re: /\b(portaria|recep[çc][ãa]o|porteiro|reception|deixar na portaria)\b/i },
  { kind: 'entrance', re: /\b(entrada|porta|acesso|port[ãa]o|fundos|lateral|entrar por|entrance|gate)\b/i },
];

function classifySegment(text: string): AccessInstructionKind {
  for (const rule of RULES) if (rule.re.test(text)) return rule.kind;
  return 'note';
}

/** Divide as observações em segmentos e classifica cada um. Vazio → []. */
export function classifyAccessNotes(notes: string | undefined): AccessInstructionView[] {
  if (!notes || !notes.trim()) return [];
  return notes
    .split(/[;\n.]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text) => ({ kind: classifySegment(text), text }));
}
