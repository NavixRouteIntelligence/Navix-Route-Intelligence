import type { DailyRawRow } from './daily-subject';
import {
  DEFAULT_ZONE,
  SETTLE_HOURS,
  dayIn,
  isSettled,
  isValidZone,
  lastWorkedDay,
  previousDay,
  resolveTimeZone,
  summaryDay,
} from './kaizen-day';

function linha(day: string, delivered = 5): DailyRawRow {
  return {
    day,
    delivered,
    failed: 0,
    onTime: delivered,
    firstActivityAt: null,
    lastActivityAt: null,
    plans: 0,
    savedKm: null,
    savedMinutes: null,
    vehicleTypes: [],
    projectedAt: new Date(`${day}T23:00:00Z`),
  };
}

describe('resolveTimeZone', () => {
  it('o fuso do perfil ganha', () => {
    expect(resolveTimeZone('Europe/Lisbon', 'America/Sao_Paulo')).toEqual({
      zone: 'Europe/Lisbon',
      source: 'user',
    });
  });

  it('sem perfil, cai no tenant — e diz que caiu', () => {
    expect(resolveTimeZone(null, 'America/Sao_Paulo')).toEqual({
      zone: 'America/Sao_Paulo',
      source: 'tenant',
    });
  });

  it('sem nenhum dos dois, UTC declarado', () => {
    expect(resolveTimeZone(null, null)).toEqual({ zone: DEFAULT_ZONE, source: 'default' });
  });

  it('string vazia não conta como escolha', () => {
    expect(resolveTimeZone('  ', '').source).toBe('default');
  });

  // Um perfil com `Europe/Lisboa` faria `Intl` lançar dentro da leitura.
  it('fuso inválido no perfil não derruba nada: continua a cadeia', () => {
    expect(resolveTimeZone('Europe/Lisboa', 'America/Sao_Paulo')).toEqual({
      zone: 'America/Sao_Paulo',
      source: 'tenant',
    });
  });

  it('inválido nos dois níveis termina em UTC', () => {
    expect(resolveTimeZone('Marte/Olimpo', 'Nowhere/Nothing').source).toBe('default');
  });

  it('isValidZone reconhece um IANA real e recusa um inventado', () => {
    expect(isValidZone('America/Sao_Paulo')).toBe(true);
    expect(isValidZone('America/Sao Paulo')).toBe(false);
  });
});

describe('summaryDay', () => {
  it('em UTC, ontem é o dia anterior do relógio', () => {
    expect(summaryDay(new Date('2026-08-09T02:30:00Z'), 'UTC')).toBe('2026-08-08');
  });

  // Às 02h30 UTC ainda é dia 8 em São Paulo (UTC−3): ontem é o 7.
  it('o fuso decide qual é «ontem»', () => {
    expect(summaryDay(new Date('2026-08-09T02:30:00Z'), 'America/Sao_Paulo')).toBe('2026-08-07');
  });

  describe('horário de verão', () => {
    // Portugal adianta o relógio em 29/03/2026 e recua em 25/10/2026.
    it('no dia em que o relógio adianta, ontem continua a ser ontem', () => {
      expect(summaryDay(new Date('2026-03-29T10:00:00Z'), 'Europe/Lisbon')).toBe('2026-03-28');
    });

    // Este é o caso que uma subtração de 24 horas erraria: no dia em que o
    // relógio recua, 24 horas atrás ainda é hoje.
    it('no dia em que o relógio recua, não se salta um dia', () => {
      expect(summaryDay(new Date('2026-10-25T10:00:00Z'), 'Europe/Lisbon')).toBe('2026-10-24');
    });

    it('a hora repetida da madrugada não muda o dia', () => {
      const antes = new Date('2026-10-25T00:30:00Z'); // 01h30 WEST
      const depois = new Date('2026-10-25T01:30:00Z'); // 01h30 WET, outra vez

      expect(dayIn(antes, 'Europe/Lisbon')).toBe(dayIn(depois, 'Europe/Lisbon'));
    });

    it('a hora que não existe na primavera também não parte o cálculo', () => {
      expect(summaryDay(new Date('2026-03-29T01:30:00Z'), 'Europe/Lisbon')).toBe('2026-03-28');
    });
  });

  it('mudar de fuso muda o dia mostrado, sem tocar nos dados', () => {
    const agora = new Date('2026-08-09T02:30:00Z');

    expect(summaryDay(agora, 'Europe/Lisbon')).toBe('2026-08-08');
    expect(summaryDay(agora, 'Pacific/Auckland')).toBe('2026-08-08');
    expect(summaryDay(agora, 'America/Los_Angeles')).toBe('2026-08-07');
  });
});

describe('previousDay', () => {
  it('atravessa o fim do mês', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
  });

  it('atravessa o fim do ano', () => {
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });
});

describe('isSettled', () => {
  const zona = 'Europe/Lisbon';

  it('ontem, antes da janela: ainda pode mudar', () => {
    // 01h00 local do dia 9 — ainda dentro da janela de correções.
    expect(isSettled('2026-08-08', new Date('2026-08-09T00:00:00Z'), zona)).toBe(false);
  });

  it(`ontem, depois de ${SETTLE_HOURS}h locais: fechado`, () => {
    expect(isSettled('2026-08-08', new Date('2026-08-09T05:00:00Z'), zona)).toBe(true);
  });

  it('anteontem está sempre fechado', () => {
    expect(isSettled('2026-08-07', new Date('2026-08-09T00:00:00Z'), zona)).toBe(true);
  });

  it('hoje nunca está fechado', () => {
    expect(isSettled('2026-08-09', new Date('2026-08-09T22:00:00Z'), zona)).toBe(false);
  });
});

describe('lastWorkedDay', () => {
  const semana = [linha('2026-08-03'), linha('2026-08-04'), linha('2026-08-05', 0)];

  it('devolve o dia mais recente com trabalho', () => {
    expect(lastWorkedDay(semana, '2026-08-08')?.day).toBe('2026-08-04');
  });

  // Folga não é um dia vazio para mostrar: é a ausência de um dia.
  it('ignora dias de folga, mesmo sendo os mais recentes', () => {
    const comFolgas = [...semana, linha('2026-08-06', 0), linha('2026-08-07', 0)];

    expect(lastWorkedDay(comFolgas, '2026-08-07')?.day).toBe('2026-08-04');
  });

  it('não olha para o futuro', () => {
    expect(lastWorkedDay(semana, '2026-08-03')?.day).toBe('2026-08-03');
  });

  it('sem nenhum dia trabalhado, não há o que mostrar', () => {
    expect(lastWorkedDay([linha('2026-08-05', 0)], '2026-08-08')).toBeNull();
  });
});
