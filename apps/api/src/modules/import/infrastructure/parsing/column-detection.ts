import type { ParsedRow } from '../../domain/ports/file-parser.port';

type Field = keyof Pick<
  ParsedRow,
  'recipient' | 'addressText' | 'phone' | 'orderNumber' | 'notes' | 'priority' | 'latitude' | 'longitude'
>;

const SYNONYMS: Record<Field, string[]> = {
  recipient: ['destinatario', 'nome', 'cliente', 'recipient', 'name', 'customer'],
  addressText: ['endereco', 'address', 'logradouro', 'rua', 'local'],
  phone: ['telefone', 'phone', 'celular', 'fone', 'contato', 'whatsapp'],
  orderNumber: ['pedido', 'encomenda', 'order', 'numero', 'tracking', 'codigo', 'nf'],
  notes: ['observacao', 'observacoes', 'obs', 'notes', 'complemento', 'nota'],
  priority: ['prioridade', 'priority'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon', 'long'],
};

const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Detecta o índice de cada campo a partir dos cabeçalhos. */
export function detectColumns(headers: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  const used = new Set<number>();
  headers.forEach((header, index) => {
    const h = normalize(String(header));
    for (const field of Object.keys(SYNONYMS) as Field[]) {
      if (map[field] !== undefined) continue;
      if (SYNONYMS[field].some((syn) => h === syn || h.includes(syn))) {
        map[field] = index;
        used.add(index);
        break;
      }
    }
  });
  return map;
}

function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function str(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

/** Monta uma ParsedRow a partir de uma linha (array de células) e do mapa de colunas. */
export function rowFromCells(
  cells: unknown[],
  map: Partial<Record<Field, number>>,
): ParsedRow {
  const at = (field: Field) => (map[field] !== undefined ? cells[map[field] as number] : undefined);
  return {
    recipient: str(at('recipient')),
    addressText: str(at('addressText')),
    phone: str(at('phone')),
    orderNumber: str(at('orderNumber')),
    notes: str(at('notes')),
    priority: str(at('priority')),
    latitude: num(at('latitude')),
    longitude: num(at('longitude')),
  };
}
