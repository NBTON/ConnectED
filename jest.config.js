module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js'
  ],
  collectCoverageFrom: [
    'services/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    '!services/repositories/BaseRepository.js',
    '!services/BaseService.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 60000,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/tests/unit/**/*.test.js'],
      setupFilesAfterEnv: [],
      testEnvironment: 'node'
    },
    {
      displayName: 'integration',
      testMatch: ['**/tests/integration/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testEnvironment: 'node',
      testTimeout: 60000
    }
  ]
};