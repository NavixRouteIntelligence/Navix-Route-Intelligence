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
    '!src/**/*.spec.ts',
    '!src/database/migrations/**',
  ],
  coverageDirectory: 'coverage',
  // Piso de cobertura OBRIGATÓRIO (ratchet): a build falha se cair abaixo disto.
  // Fixado logo abaixo do medido atual — elevar conforme a suíte cresce (a meta
  // de docs/coding-standards.md é ≥80% em domínio/aplicação).
  coverageThreshold: {
    global: {
      statements: 24,
      branches: 37,
      functions: 25,
      lines: 24,
    },
  },
  testEnvironment: 'node',
};
