/**
 * ESLint do backend — reforça as fronteiras da Clean Architecture e dos módulos
 * (ver docs/architecture.md e docs/coding-standards.md).
 *
 * Regras de fronteira:
 *  - domain NÃO pode importar de application, infrastructure ou interface.
 *  - application NÃO pode importar de infrastructure ou interface.
 *  - módulos de negócio NÃO importam internals uns dos outros (apenas shared/contracts).
 */
module.exports = {
  root: true,
  extends: ['../../.eslintrc.json'],
  plugins: ['boundaries'],
  settings: {
    'boundaries/elements': [
      { type: 'domain', pattern: 'src/modules/*/domain/**' },
      { type: 'application', pattern: 'src/modules/*/application/**' },
      { type: 'infrastructure', pattern: 'src/modules/*/infrastructure/**' },
      { type: 'interface', pattern: 'src/modules/*/interface/**' },
      { type: 'shared', pattern: 'src/shared/**' },
    ],
  },
  rules: {
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          { from: 'domain', allow: ['domain', 'shared'] },
          { from: 'application', allow: ['application', 'domain', 'shared'] },
          {
            from: 'infrastructure',
            allow: ['infrastructure', 'application', 'domain', 'shared'],
          },
          {
            from: 'interface',
            allow: ['interface', 'application', 'domain', 'shared'],
          },
          { from: 'shared', allow: ['shared'] },
        ],
      },
    ],
  },
};
