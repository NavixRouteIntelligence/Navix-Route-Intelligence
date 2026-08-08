/**
 * Bloqueia rede real durante os testes (ADR-0115).
 *
 * Hoje nenhum teste chama a rede — mas por acidente, não por regra: cada suíte
 * dubla o `fetch` por conta própria, e basta um novo teste esquecer para a
 * suíte passar a depender do Mapbox, do humor da conexão e da cota da chave.
 * O sintoma seria um vermelho intermitente e insondável, meses depois.
 *
 * Aqui o `fetch` **não dublado** falha na hora, dizendo qual URL foi pedida.
 * Quem precisa de rede num teste continua dublando `global.fetch`, como já se
 * faz — este guarda pega o esquecimento, não o uso deliberado.
 */
const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = (async (input: unknown) => {
    const url =
      typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
    throw new Error(
      `Teste tentou chamar a rede: ${url}\n` +
        'A suíte é determinística e independente do provedor externo (ADR-0115). ' +
        'Duble `global.fetch` no teste, ou use uma fixture de test/fixtures/.',
    );
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});
