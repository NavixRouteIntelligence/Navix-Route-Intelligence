/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@navix/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/main-worker.ts',
    '!src/**/*.spec.ts',
    '!src/database/migrations/**',
    // Seeds/utilitários de dev (não são código de aplicação a cobrir).
    '!src/database/seed*.ts',
  ],
  coverageDirectory: 'coverage',
  // Piso de cobertura OBRIGATÓRIO (ratchet): a build falha se cair abaixo disto.
  // Fixado logo abaixo do medido atual — elevar conforme a suíte cresce (a meta
  // de docs/coding-standards.md é ≥80% em domínio/aplicação).
  coverageThreshold: {
    // Nota: os pisos por-diretório abaixo REMOVEM esses arquivos do cálculo
    // "global" do Jest, então o global aqui cobre o restante (infra, interface,
    // domínio, shared) — mais baixo por natureza, melhor coberto por E2E.
    global: {
      statements: 42,
      branches: 56,
      functions: 43,
      lines: 42,
    },
    // Núcleo de negócio (auditoria 5, R6): a camada de aplicação — onde mora a
    // lógica — não pode cair abaixo de 60%. Encoda a meta por-módulo, não só a
    // global (que é diluída por infra/interface, melhor cobertas por E2E).
    './src/modules/delivery/application/': { statements: 60, lines: 60 },
    './src/modules/identity/application/': { statements: 60, lines: 60 },
    './src/modules/optimizer/application/': { statements: 80, lines: 80 },
    './src/modules/tracking/application/': { statements: 60, lines: 60 },
  },
  testEnvironment: 'node',
};
