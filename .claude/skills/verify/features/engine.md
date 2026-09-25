# Engine

`@outlive/core`: the model, the analysis, the guard, the fixes, the presets and the documents. No DOM, no I/O.

<!-- covers: export:@outlive/core -->

## Sub-features

- analysis: `analyze`, scenarios, availability, timing, implications; every rule fires in `shapes.fixture.ts`.
- guard: `inspect`, `inspectDeep`; seed words, four-letter stamps, wordlist indexes, hex entropy.
- fixes: `candidateFixes`, `fixesFor`, `improve`.
- shapes and presets: `planFromShape`, `PRESETS`.
- documents: runbook, recovery routes, successor letters.

## How to reach it

- `import { ... } from '@outlive/core'`, or `packages/core/src/index.ts` directly in a script.

## How to check it

Static: `make test-core` (310 tests, including `self-check.test.ts` over every shape and pair).

Runtime:

```sh
cd packages/core && cat > src/zz-probe.test.ts <<'T'
import { it } from 'vitest'
import { analyze, exampleById, improve } from './index.ts'
it('probe', () => { const p = exampleById('two-of-three')!; const r = improve(p, { maxSteps: 1 }); process.stdout.write('PROBE ' + analyze(p).counts.critical + ' -> ' + analyze(r.plan).counts.critical + '\n') })
T
npx vitest run src/zz-probe.test.ts | grep PROBE; rm src/zz-probe.test.ts
```

Proves it when: it prints `PROBE 7 -> 6` or fewer on the right.

## Gotchas

- There is one evaluator (`analysis/availability.ts`); nothing may compute its own verdicts.
- Read the sentences, not just the counts: `docs/checking-the-interface.md` says how.
