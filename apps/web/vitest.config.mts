import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * The interface's own tests.
 *
 * These are not unit tests of components. They mount the whole application and
 * drive it, because the questions worth asking here are "does it run" and "does
 * a field refuse a seed phrase", and neither survives being asked of a
 * component in isolation.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.tsx', 'lib/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.next-dev/**', 'out/**'],
  },
})
