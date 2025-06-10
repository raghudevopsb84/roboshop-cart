module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server.js',
    '!**/node_modules/**',
  ],
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['./__tests__/setup.js'],
  verbose: true
}; 