import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The engine's suites run the whole analysis hundreds of times. Five
    // seconds is plenty on a quiet machine and fails spuriously on a busy one,
    // where several suites and sessions share the cores; a real regression in
    // speed shows up as minutes, not as the difference between five and twenty.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/guard/bip39-english.ts', 'src/index.ts'],
    },
  },
})
