import { detectColumns, rowFromCells } from './column-detection';

describe('detectColumns', () => {
  it('mapeia sinônimos em português (com acento) para os campos', () => {
    const map = detectColumns(['Destinatário', 'Endereço', 'Telefone', 'Nº Pedido', 'Observações', 'Prioridade']);
    expect(map.recipient).toBe(0);
    expect(map.addressText).toBe(1);
    expect(map.phone).toBe(2);
    expect(map.orderNumber).toBe(3);
    expect(map.notes).toBe(4);
    expect(map.priority).toBe(5);
  });

  it('mapeia cabeçalhos em inglês e lat/lng', () => {
    const map = detectColumns(['Name', 'Address', 'Phone', 'Latitude', 'Longitude']);
    expect(map.recipient).toBe(0);
    expect(map.addressText).toBe(1);
    expect(map.phone).toBe(2);
    expect(map.latitude).toBe(3);
    expect(map.longitude).toBe(4);
  });

  it('ignora colunas desconhecidas', () => {
    const map = detectColumns(['Foo', 'Bar']);
    expect(Object.keys(map)).toHaveLength(0);
  });
});

describe('rowFromCells', () => {
  it('extrai valores e converte lat/lng com vírgula decimal', () => {
    const map = detectColumns(['nome', 'endereco', 'lat', 'lng']);
    const row = rowFromCells(['Maria', 'Rua A, 100', '-23,55', '-46,63'], map);
    expect(row.recipient).toBe('Maria');
    expect(row.addressText).toBe('Rua A, 100');
    expect(row.latitude).toBeCloseTo(-23.55);
    expect(row.longitude).toBeCloseTo(-46.63);
  });

  it('retorna undefined para células vazias', () => {
    const map = detectColumns(['nome', 'telefone']);
    const row = rowFromCells(['', '   '], map);
    expect(row.recipient).toBeUndefined();
    expect(row.phone).toBeUndefined();
  });
});
