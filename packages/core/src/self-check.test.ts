import { describe, expect, it } from 'vitest'
import { analyze } from './analysis/analyze.ts'
import { createContext } from './analysis/context.ts'
import { RULES } from './analysis/findings.ts'
import { buildRunbook } from './documents/runbook.ts'
import { recoveryRoutes } from './documents/recovery.ts'
import { lettersFor } from './documents/successor-letter.ts'
import { EXAMPLES, exampleById } from './model/examples.ts'
import { inspect } from './guard/guard.ts'
import { parsePlanFile, referentialProblems } from './model/schema.ts'
import { SCHEMA_VERSION, type Plan } from './model/types.ts'

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

/**
 * Plan shapes the worked examples do not contain.
 *
 * The three examples exercise twenty six of the sixty five rules, so for most
 * of them nothing had ever read the sentence they produce. Two of those
 * sentences turned out to be refused by this program's own guard, which is the
 * one thing the checks below exist to make impossible. Each mutation here is
 * the smallest change that makes a different family of rules speak.
 */
function shapes(): [string, Plan][] {
  const mutations: [string, (plan: Plan) => void][] = [
    [
      'memorised passphrases',
      (plan) => {
        for (const key of plan.keys) {
          key.passphrase = {
            enabled: true,
            storage: 'memorized',
            locationIds: [],
            splitThreshold: null,
            knownBy: [],
          }
        }
      },
    ],
    [
      'a passphrase beside the seed',
      (plan) => {
        for (const key of plan.keys) {
          key.passphrase = {
            enabled: true,
            storage: 'written',
            locationIds: ['loc_home'],
            splitThreshold: null,
            knownBy: [],
          }
        }
      },
    ],
    [
      'a key with neither a device nor a backup',
      (plan) => {
        plan.keys[0].deviceId = null
        plan.keys[0].backups = []
      },
    ],
    ['everything in one place', (plan) => void (plan.locations = [plan.locations[0]])],
    [
      'nobody described',
      (plan) => {
        plan.people = []
        for (const location of plan.locations) {
          location.access = []
          location.custodianId = null
        }
      },
    ],
    [
      'every concern named',
      (plan) =>
        void (plan.profile.concerns = [
          'loss',
          'theft',
          'fire-flood',
          'death',
          'incapacity',
          'coercion',
          'insider',
          'legal-seizure',
          'supply-chain',
        ]),
    ],
    [
      'paper across a century',
      (plan) => {
        plan.profile.horizonYears = 100
        for (const key of plan.keys) for (const backup of key.backups) backup.medium = 'paper'
      },
    ],
    [
      'unencrypted digital backups',
      (plan) => {
        for (const key of plan.keys) {
          for (const backup of key.backups) backup.medium = 'plain-digital'
        }
      },
    ],
    [
      'no device PIN',
      (plan) => {
        for (const device of plan.devices) {
          device.pin = { storage: 'none', locationId: null, knownBy: [] }
        }
      },
    ],
    [
      'the PIN beside the device',
      (plan) => {
        for (const device of plan.devices) {
          device.pin = { storage: 'written', locationId: 'loc_home', knownBy: [] }
        }
      },
    ],
    ['key material on the person', (plan) => void (plan.locations[0].kind = 'on-person')],
    ['a service co-signer', (plan) => void (plan.devices[0].kind = 'service-cosigner')],
    [
      'a timelock on the only way to spend',
      (plan) => void (plan.wallets[0].paths = [{ ...plan.wallets[0].paths[0], timelockDays: 365 }]),
    ],
    [
      'a key no spend path uses',
      (plan) => {
        for (const wallet of plan.wallets) {
          for (const path of wallet.paths) {
            path.keyIds = path.keyIds.filter((id) => id !== 'key_c')
          }
        }
      },
    ],
    ['two keys on one device', (plan) => void (plan.keys[1].deviceId = plan.keys[0].deviceId)],
  ]
  return mutations.map(([name, mutate]) => {
    const plan = structuredClone(exampleById('two-of-three')!)
    mutate(plan)
    return [name, plan]
  })
}

/** Every sentence one plan makes this program write. */
function everySentence(plan: Plan): string[] {
  const ctx = createContext(plan, { today: '2026-03-01' })
  return strings([
    analyze(plan, { today: '2026-03-01' }).findings,
    buildRunbook(plan),
    recoveryRoutes(ctx),
    lettersFor(ctx),
  ])
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

  for (const [name, plan] of shapes()) {
    it(`every sentence for a plan with ${name} passes`, () => {
      for (const text of everySentence(plan)) {
        const refusals = inspect(text).hits.filter((hit) => hit.strength === 'refuse')
        expect(refusals, text).toEqual([])
      }
    })
  }

  /**
   * Counted prose has to agree with its own number.
   *
   * "Relocate material for at least 1 keys" shipped for months. It reads as
   * carelessness, which is the one thing a tool whose whole claim is rigour
   * cannot afford to read as, and it is mechanically checkable.
   */
  // "1 keys", "1 places", "1 days", and the other way round: "2 key".
  const plural =
    /\b1 (?:keys|places|wallets|days|devices|people|backups|shares|copies|steps|months|years|hours|minutes|locations|signatures|findings|vendors)\b/i
  const singular =
    /\b(?!1\b)\d+ (?:key|place|wallet|day|device|person|backup|share|copy|step|month|year|hour|minute|location|signature|finding|vendor)\b/i

  for (const [name, plan] of [
    ...EXAMPLES.map((example) => [`"${example.name}"`, example.build()] as [string, Plan]),
    ...shapes().map(([name, plan]) => [`a plan with ${name}`, plan] as [string, Plan]),
  ]) {
    it(`counts things correctly in every sentence for ${name}`, () => {
      for (const text of everySentence(plan)) {
        expect(plural.test(text) ? text : null, text).toBeNull()
        expect(singular.test(text) ? text : null, text).toBeNull()
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
    it(`"${example.name}" survives a save and an open unchanged`, () => {
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
      // Not merely valid: identical. A save that quietly drops a field is a
      // save that quietly changes the analysis.
      if (parsed.ok) expect(parsed.value.plans[0]).toEqual(plan)
    })

    it(`"${example.name}" analyses identically after a round trip`, () => {
      const plan = example.build()
      const parsed = parsePlanFile(
        JSON.parse(
          JSON.stringify({
            schemaVersion: SCHEMA_VERSION,
            generator: 'test',
            savedAt: '2026-03-01',
            plans: [plan],
            activePlanId: plan.id,
          })
        )
      )
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) return
      const before = analyze(plan, { today: '2026-03-01' })
      const after = analyze(parsed.value.plans[0], { today: '2026-03-01' })
      expect(after.findings.map((finding) => finding.id)).toEqual(
        before.findings.map((finding) => finding.id)
      )
    })
  }

  it('carries runbook progress across a save', () => {
    const plan = { ...EXAMPLES[1].build(), progress: { 'verify-key_a': '2026-02-02' } }
    const parsed = parsePlanFile(
      JSON.parse(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          generator: 'test',
          savedAt: '2026-03-01',
          plans: [plan],
          activePlanId: plan.id,
        })
      )
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.plans[0].progress).toEqual({ 'verify-key_a': '2026-02-02' })
  })
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

describe('the documented vendor data format', () => {
  it('accepts the example this repository ships', async () => {
    // A worked example in the docs that the parser rejects is worse than none.
    const { readFileSync } = await import('node:fs')
    const { parseVendorData } = await import('./vendors/vendors.ts')
    const raw: unknown = JSON.parse(
      readFileSync(new URL('../../../docs/vendor-data.example.json', import.meta.url), 'utf8')
    )
    const parsed = parseVendorData(raw)
    expect(parsed.ok ? [] : parsed.problems).toEqual([])
    if (parsed.ok) expect(parsed.value.vendors.length).toBeGreaterThan(0)
  })

  it('refuses a file with no date, because an undated claim cannot be judged', async () => {
    const { parseVendorData } = await import('./vendors/vendors.ts')
    const parsed = parseVendorData({ version: 1, vendors: [] })
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? '' : parsed.problems.join(' ')).toContain('asOf')
  })
})
