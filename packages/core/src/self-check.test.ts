import { describe, expect, it } from 'vitest'
import { analyze } from './analysis/analyze.ts'
import { createContext } from './analysis/context.ts'
import { RULES } from './analysis/findings.ts'
import { buildRunbook } from './documents/runbook.ts'
import { recoveryRoutes } from './documents/recovery.ts'
import { lettersFor } from './documents/successor-letter.ts'
import { EXAMPLES } from './model/examples.ts'
import { inspect } from './guard/guard.ts'
import { parsePlanFile, referentialProblems } from './model/schema.ts'
import { SCHEMA_VERSION } from './model/types.ts'

/**
 * The program has to hold itself to the rule it holds the user to. Every
 * sentence it generates goes through its own guard, because prose written about
 * seed words is exactly the prose most likely to trip it, and a guard its
 * author quietly exempts himself from is not a guard.
 */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const entry of value) strings(entry, out)
  else if (value && typeof value === 'object')
    for (const entry of Object.values(value)) strings(entry, out)
  return out
}

describe('the program obeys its own guard', () => {
  for (const example of EXAMPLES) {
    it(`every sentence generated for "${example.name}" passes`, () => {
      const plan = example.build()
      const ctx = createContext(plan, { today: '2026-03-01' })
      const generated = [
        analyze(plan, { today: '2026-03-01' }).findings,
        buildRunbook(plan),
        recoveryRoutes(ctx),
        lettersFor(ctx),
      ]
      for (const text of strings(generated)) {
        const result = inspect(text)
        const refusals = result.hits.filter((hit) => hit.strength === 'refuse')
        expect(refusals, text).toEqual([])
      }
    })
  }

  it('every rule description passes', () => {
    for (const text of strings(Object.values(RULES))) {
      expect(
        inspect(text).hits.filter((hit) => hit.strength === 'refuse'),
        text
      ).toEqual([])
    }
  })
})

describe('the worked examples are valid plan files', () => {
  for (const example of EXAMPLES) {
    it(`"${example.name}" round-trips through the schema`, () => {
      const plan = example.build()
      const file = {
        schemaVersion: SCHEMA_VERSION,
        generator: 'test',
        savedAt: '2026-03-01',
        plans: [plan],
        activePlanId: plan.id,
      }
      const parsed = parsePlanFile(JSON.parse(JSON.stringify(file)))
      expect(parsed.ok ? [] : parsed.problems).toEqual([])
      expect(referentialProblems(plan)).toEqual([])
    })
  }
})

describe('the plan file format', () => {
  it('refuses a file from a newer build rather than half-reading it', () => {
    const parsed = parsePlanFile({
      schemaVersion: SCHEMA_VERSION + 1,
      generator: 'future',
      savedAt: '2030-01-01',
      plans: [EXAMPLES[0].build()],
      activePlanId: null,
    })
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? '' : parsed.problems[0]).toContain('newer version')
  })

  it('explains what is wrong with a file it cannot read', () => {
    const parsed = parsePlanFile({ schemaVersion: 1, plans: [] })
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.problems.length).toBeGreaterThan(0)
  })

  it('is not fooled by something that is not a plan at all', () => {
    for (const junk of [null, 42, 'a string', [], {}]) {
      expect(parsePlanFile(junk).ok).toBe(false)
    }
  })
})
