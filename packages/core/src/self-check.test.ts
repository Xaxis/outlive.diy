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

describe('a file somebody edited by hand', () => {
  // Plans are files the user owns, which means they will be opened in a text
  // editor. Refusing one over a boolean somebody deleted is pedantry dressed
  // as safety, so anything with a safe default gets one, and the defaults are
  // the cautious ones.

  const minimal = {
    schemaVersion: SCHEMA_VERSION,
    plans: [
      {
        schemaVersion: SCHEMA_VERSION,
        id: 'plan_mine',
        name: 'Mine',
        kind: 'current',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
  }

  it('opens with nothing but identity and dates', () => {
    const parsed = parsePlanFile(structuredClone(minimal))
    expect(parsed.ok ? [] : parsed.problems).toEqual([])
    if (!parsed.ok) return
    const plan = parsed.value.plans[0]
    expect(plan.locations).toEqual([])
    expect(plan.wallets).toEqual([])
    expect(plan.progress).toEqual({})
    expect(plan.profile.horizonYears).toBe(30)
  })

  it('defaults cautiously rather than flatteringly', () => {
    const parsed = parsePlanFile({
      ...structuredClone(minimal),
      plans: [
        {
          ...minimal.plans[0],
          devices: [{ id: 'd', label: 'Signer A', kind: 'hardware-signer' }],
          keys: [{ id: 'k', label: 'Key A', deviceId: 'd' }],
        },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const [device] = parsed.value.plans[0].devices
    // Every one of these defaults produces a finding rather than silence.
    expect(device.airGapped).toBe(false)
    expect(device.storesWalletConfig).toBe(false)
    expect(device.supplyChain).toBe('unknown')
    expect(parsed.value.plans[0].keys[0].backups).toEqual([])
  })

  it('still refuses a file with no identity, because that cannot be guessed', () => {
    const parsed = parsePlanFile({
      schemaVersion: SCHEMA_VERSION,
      plans: [{ schemaVersion: SCHEMA_VERSION, name: 'No id' }],
    })
    expect(parsed.ok).toBe(false)
  })

  it('still refuses a date that is not a date', () => {
    const parsed = parsePlanFile({
      ...structuredClone(minimal),
      plans: [{ ...minimal.plans[0], updatedAt: 'last Tuesday' }],
    })
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? '' : parsed.problems.join(' ')).toContain('YYYY-MM-DD')
  })

  it('analyses what it filled in, without pretending it is complete', () => {
    const parsed = parsePlanFile({
      ...structuredClone(minimal),
      plans: [
        {
          ...minimal.plans[0],
          locations: [{ id: 'a', label: 'Site A', kind: 'home' }],
          keys: [{ id: 'k', label: 'Key A' }],
          wallets: [
            {
              id: 'w',
              label: 'Vault',
              tier: 'vault',
              stake: 'large',
              paths: [{ id: 'p', label: 'Everyday', kind: 'primary', threshold: 1, keyIds: ['k'] }],
            },
          ],
        },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const report = analyze(parsed.value.plans[0], { today: '2026-03-01' })
    // A key with neither a device nor a backup is the first thing it says.
    expect(report.findings.map((finding) => finding.rule)).toContain('S005')
  })
})
