import {
  DESTINATION_SERVICE_MINUTES,
  classifyDestination,
  serviceMinutesForDestination,
} from './destination-type';

describe('destination-type (ADR-0064)', () => {
  describe('classifyDestination', () => {
    it('classifica por palavra-chave (pt), ignorando acento e caixa', () => {
      expect(classifyDestination('Hospital São Lucas')).toBe('hospital');
      expect(classifyDestination('SHOPPING Iguatemi')).toBe('mall');
      expect(classifyDestination('Rua X, Apartamento 42')).toBe('apartment');
      expect(classifyDestination('Condomínio Jardim, Bloco B')).toBe('condo');
      expect(classifyDestination('Loja de conveniência')).toBe('commerce');
      expect(classifyDestination('Acme Ltda')).toBe('company');
      expect(classifyDestination('Casa amarela')).toBe('residence');
    });

    it('retorna null quando nada casa (não chuta residência)', () => {
      expect(classifyDestination('Av. Paulista 1000')).toBeNull();
      expect(classifyDestination('')).toBeNull();
      expect(classifyDestination(null)).toBeNull();
      expect(classifyDestination(undefined)).toBeNull();
    });

    it('prioriza hospital/shopping sobre termos genéricos', () => {
      // "casa" apareceria, mas "hospital" tem prioridade na ordem das regras.
      expect(classifyDestination('Casa de saúde / Hospital')).toBe('hospital');
    });
  });

  describe('serviceMinutesForDestination', () => {
    it('retorna o tempo por tipo', () => {
      expect(serviceMinutesForDestination('hospital')).toBe(DESTINATION_SERVICE_MINUTES.hospital);
      expect(serviceMinutesForDestination('residence')).toBe(3);
      expect(serviceMinutesForDestination('hospital')).toBeGreaterThan(
        serviceMinutesForDestination('residence')!,
      );
    });

    it('null para other/ausente (cai no global)', () => {
      expect(serviceMinutesForDestination('other')).toBeNull();
      expect(serviceMinutesForDestination(undefined)).toBeNull();
      expect(serviceMinutesForDestination(null)).toBeNull();
    });
  });
});

describe('classifyDestination com destinatário (ADR-0076)', () => {
  it('classifica pelo destinatário quando o endereço não tem sinal', () => {
    // O caso real que jogava tudo em "outros": endereços brasileiros/portugueses
    // não contêm "loja"/"casa"/"apartamento".
    expect(classifyDestination('Av. Paulista, 1000')).toBeNull();
    expect(classifyDestination('Av. Paulista, 1000', 'Acme Ltda')).toBe('company');
  });

  it('reconhece comércio e saúde pelo nome de quem recebe', () => {
    expect(classifyDestination('Rua Augusta, 900', 'Padaria do Zé')).toBe('commerce');
    expect(classifyDestination('Rua Vergueiro, 3000', 'Hospital São Luiz')).toBe('hospital');
  });

  it('o endereço continua valendo sozinho', () => {
    expect(classifyDestination('Shopping Center Norte, Loja 12')).toBe('mall');
  });

  it('destinatário sem sinal não inventa classificação', () => {
    expect(classifyDestination('Rua A, 10', 'João Silva')).toBeNull();
  });

  it('sem endereço nem destinatário devolve null', () => {
    expect(classifyDestination(null, null)).toBeNull();
    expect(classifyDestination('', '')).toBeNull();
  });
});
