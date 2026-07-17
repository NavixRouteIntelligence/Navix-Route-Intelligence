import { Workbook } from 'exceljs';

import { XlsxParser } from './xlsx.parser';

/** Gera um .xlsx real em memória para o round-trip. */
async function workbookBuffer(rows: unknown[][]): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Entregas');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('XlsxParser (ExcelJS — ADR-0047)', () => {
  const parser = new XlsxParser();

  it('lê a primeira aba e mapeia as colunas por sinônimo', async () => {
    const buffer = await workbookBuffer([
      ['Destinatário', 'Endereço', 'Telefone', 'Latitude', 'Longitude'],
      ['Ana Souza', 'Rua Augusta, 100', '11999998888', -23.55, -46.63],
      ['Bruno Lima', 'Av. Paulista, 900', '11888887777', -23.56, -46.65],
    ]);

    const rows = await parser.parse(buffer);

    expect(rows).toHaveLength(2);
    expect(rows[0].recipient).toBe('Ana Souza');
    expect(rows[0].addressText).toBe('Rua Augusta, 100');
    expect(rows[0].phone).toBe('11999998888');
    expect(rows[0].latitude).toBeCloseTo(-23.55);
    expect(rows[0].longitude).toBeCloseTo(-46.63);
    expect(rows[1].recipient).toBe('Bruno Lima');
  });

  it('planilha só com cabeçalho → nenhuma linha', async () => {
    const rows = await parser.parse(await workbookBuffer([['Destinatário', 'Endereço']]));
    expect(rows).toEqual([]);
  });

  it('normaliza células de fórmula e rich text para texto', async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRow(['Destinatário', 'Endereço']);
    const row = ws.addRow([]);
    row.getCell(1).value = { richText: [{ text: 'Ana ' }, { text: 'Souza' }] };
    row.getCell(2).value = { formula: 'A1', result: 'Rua X, 1' };
    const rows = await parser.parse(Buffer.from(await wb.xlsx.writeBuffer()));

    expect(rows[0].recipient).toBe('Ana Souza');
    expect(rows[0].addressText).toBe('Rua X, 1');
  });
});
