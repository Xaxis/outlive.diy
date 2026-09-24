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
    // jsdom rather than happy-dom: these tests drive the fragment router, and
    // happy-dom does not keep location.hash in step with history changes.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Every test mounts the whole application and runs the real engine,
    // including the fix search, which tries hundreds of plans. Five seconds
    // is enough on an idle machine and not on a loaded one, and a timeout is
    // not a finding about the interface.
    testTimeout: 20_000,
    include: ['**/*.test.tsx', 'lib/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.next-dev/**', 'out/**'],
  },
})
