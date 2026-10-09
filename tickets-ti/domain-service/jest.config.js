module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/infrastructure/persistencia/migraciones/**',
    '!src/infrastructure/persistencia/configCli.js',
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 80, lines: 80, statements: 80 },
  },
  testTimeout: 30000,
  // Las suites de infraestructura comparten tickets_domain_test y la recrean
  // con sync({ force: true }): en paralelo se pisarían entre sí.
  maxWorkers: 1,
  verbose: true,
};
