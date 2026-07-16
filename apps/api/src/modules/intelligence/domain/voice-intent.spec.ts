import { interpretVoiceCommand } from './voice-intent';

describe('interpretVoiceCommand', () => {
  it('reconhece "próxima parada" (pt-BR, com acento)', () => {
    const r = interpretVoiceCommand('Qual é a próxima parada?');
    expect(r.intent).toBe('next_stop');
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('reconhece "next stop" (en)', () => {
    expect(interpretVoiceCommand('what is the next stop').intent).toBe('next_stop');
  });

  it('reconhece "siguiente parada" (es)', () => {
    expect(interpretVoiceCommand('cuál es la siguiente parada').intent).toBe('next_stop');
  });

  it('reconhece marcar entregue', () => {
    expect(interpretVoiceCommand('marcar como entregue').intent).toBe('mark_delivered');
  });

  it('reconhece reportar estacionamento e extrai a dificuldade', () => {
    const r = interpretVoiceCommand('estacionamento difícil aqui');
    expect(r.intent).toBe('report_parking');
    expect(r.slots.parkingDifficulty).toBe('hard');
  });

  it('reconhece resumo da rota', () => {
    expect(interpretVoiceCommand('me dá um resumo da rota').intent).toBe('route_summary');
  });

  it('reconhece quanto falta', () => {
    expect(interpretVoiceCommand('quanto falta para terminar').intent).toBe('remaining');
  });

  it('reconhece pedido de ajuda', () => {
    expect(interpretVoiceCommand('ajuda').intent).toBe('help');
  });

  it('devolve unknown para fala sem correspondência', () => {
    const r = interpretVoiceCommand('qual a cor do céu');
    expect(r.intent).toBe('unknown');
    expect(r.confidence).toBe(0);
  });

  it('devolve unknown para transcrição vazia', () => {
    expect(interpretVoiceCommand('   ').intent).toBe('unknown');
  });
});
