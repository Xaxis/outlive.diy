import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// eslint-config-next ships flat configs directly from version 16, so there is
// no compatibility shim here.
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Underscore-prefixed arguments are the render-callback convention used in
      // a few places. Explicit `any` stays banned.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['.next/**', '.next-dev/**', 'out/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default config
