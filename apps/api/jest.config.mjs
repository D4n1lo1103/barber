/** Test unitari del backend: Jest in modalità ESM, come il codice applicativo. */
export default {
  rootDir: 'src',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@barber/shared$': '<rootDir>/../../../packages/shared/dist/esm/index.js',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts'],
  coverageDirectory: '../coverage',
};
