/**
 * Test di integrazione: avviano l'applicazione Nest completa e usano
 * il database PostgreSQL indicato da DATABASE_URL.
 */
export default {
  rootDir: 'test',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '.*\\.integrazione\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@barber/shared$': '<rootDir>/../../../packages/shared/dist/esm/index.js',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 30_000,
};
