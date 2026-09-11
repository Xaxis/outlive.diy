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
 * The three examples exercise twenty six of the sixty five rules, so for the
 * other thirty nine nothing had ever read the sentence they produce. Two of
 * those sentences turned out to be refused by this program's own guard, which
 * is the one thing the checks below exist to make impossible, and three
 * disagreed with their own numbers.
 *
 * Between these and the examples every rule fires at least once, which is what
 * `every rule has had its sentence read` asserts. Each mutation is the smallest
 * change that makes a family of rules speak, and several exist only because a
 * rule declined to fire for a reason worth knowing: R004 skips anybody who
 * could already spend, so its shape needs a passphrase to be the thing
 * stopping them, and L005 only speaks when the group is worse than its
 * members, so its shape needs the descriptor kept outside the group.
 */
function shapes(): [string, Plan][] {
  const mutations: [string, (plan: Plan) => void][] = [
    [
      'memorised passphrases',
      (p) => {
        p.keys.forEach((k) => {
          k.passphrase = {
            enabled: true,
            storage: 'memorized',
            locationIds: [],
            splitThreshold: null,
            knownBy: [],
          }
        })
      },
    ],
    [
      'passphrase beside the seed',
      (p) => {
        p.keys.forEach((k) => {
          k.passphrase = {
            enabled: true,
            storage: 'written',
            locationIds: ['loc_home'],
            splitThreshold: null,
            knownBy: [],
          }
        })
      },
    ],
    [
      'key with nothing',
      (p) => {
        p.keys[0].deviceId = null
        p.keys[0].backups = []
      },
    ],
    [
      'one place',
      (p) => {
        p.locations = [p.locations[0]]
      },
    ],
    [
      'nobody',
      (p) => {
        p.people = []
        p.locations.forEach((l) => {
          l.access = []
          l.custodianId = null
        })
      },
    ],
    [
      'every concern',
      (p) => {
        p.profile.concerns = [
          'loss',
          'theft',
          'fire-flood',
          'death',
          'incapacity',
          'coercion',
          'insider',
          'supply-chain',
          'legal-seizure',
        ]
      },
    ],
    [
      'paper century',
      (p) => {
        p.profile.horizonYears = 100
        p.keys.forEach((k) =>
          k.backups.forEach((b) => {
            b.medium = 'paper'
          })
        )
      },
    ],
    [
      'plain digital',
      (p) => {
        p.keys.forEach((k) =>
          k.backups.forEach((b) => {
            b.medium = 'plain-digital'
          })
        )
      },
    ],
    [
      'no pin',
      (p) => {
        p.devices.forEach((d) => {
          d.pin = { storage: 'none', locationId: null, knownBy: [] }
        })
      },
    ],
    [
      'pin beside device',
      (p) => {
        p.devices.forEach((d) => {
          d.pin = { storage: 'written', locationId: 'loc_home', knownBy: [] }
        })
      },
    ],
    [
      'on person',
      (p) => {
        p.locations[0].kind = 'on-person'
      },
    ],
    [
      'service cosigner',
      (p) => {
        p.devices[0].kind = 'service-cosigner'
      },
    ],
    [
      'timelock only',
      (p) => {
        p.wallets[0].paths = [{ ...p.wallets[0].paths[0], timelockDays: 365 }]
      },
    ],
    [
      'orphan key',
      (p) => {
        p.wallets.forEach((w) =>
          w.paths.forEach((path) => {
            path.keyIds = path.keyIds.filter((k) => k !== 'key_c')
          })
        )
      },
    ],
    [
      'two on one device',
      (p) => {
        p.keys[1].deviceId = p.keys[0].deviceId
      },
    ],
    [
      'no way to spend',
      (p) => {
        p.wallets[0].paths = []
      },
    ],
    [
      'threshold above the keys',
      (p) => {
        p.wallets[0].paths[0].threshold = 9
      },
    ],
    [
      'a path with no keys',
      (p) => {
        p.wallets[0].paths[0].keyIds = []
      },
    ],
    [
      'no written backup',
      (p) => {
        p.keys.forEach((k) => {
          k.backups = []
        })
      },
    ],
    [
      'nothing has a place',
      (p) => {
        p.keys.forEach((k) => {
          k.deviceLocationId = null
          k.backups.forEach((b) => {
            b.locationId = null
          })
        })
      },
    ],
    [
      'no configuration backup',
      (p) => {
        p.wallets.forEach((w) => {
          w.configBackups = []
        })
      },
    ],
    [
      'split short of its threshold',
      (p) => {
        p.keys[0].backups[0].split = { groupId: 'g1', threshold: 5 }
      },
    ],
    [
      'a hot wallet holding most of it',
      (p) => {
        p.wallets[0].tier = 'hot'
        p.wallets[0].stake = 'large'
      },
    ],
    [
      'a co-signer with no key',
      (p) => {
        p.people.push({
          id: 'per_co',
          label: 'Co-signer 1',
          role: 'cosigner',
          availability: 'days',
          technicalSkill: 'competent',
          knowsPlanExists: true,
          knowsWhereInstructionsAre: true,
          notes: '',
        })
      },
    ],
    [
      'a place with no disaster group',
      (p) => {
        p.locations.forEach((l) => {
          l.disasterGroup = null
        })
      },
    ],
    [
      'one backup is the whole margin',
      (p) => {
        p.keys.forEach((k, i) => {
          if (i > 0) {
            k.deviceId = null
          }
        })
      },
    ],
    [
      'everything in one disaster group',
      (p) => {
        p.locations.forEach((l) => {
          l.disasterGroup = 'Home city'
        })
      },
    ],
    [
      'a tolerance of nothing',
      (p) => {
        p.profile.recoveryToleranceDays = 0
        p.locations.forEach((l) => {
          l.travelMinutes = 600
        })
      },
    ],
    [
      'one person can open everything',
      (p) => {
        p.locations.forEach((l) => {
          l.access = [{ personId: 'per_successor', condition: 'always', delayDays: 0 }]
        })
      },
    ],
    [
      'one architecture',
      (p) => {
        p.devices.forEach((d) => {
          d.architecture = 'One silicon'
        })
      },
    ],
    [
      'one supply route',
      (p) => {
        p.devices.forEach((d) => {
          d.supplyChain = 'second-hand'
        })
      },
    ],
    [
      'a successor who was never told',
      (p) => {
        p.people.forEach((x) => {
          x.knowsPlanExists = false
          x.knowsWhereInstructionsAre = false
        })
      },
    ],
    [
      'losing one backup ends it',
      (p) => {
        p.keys.forEach((k) => {
          k.deviceId = null
          k.deviceLocationId = null
        })
        p.wallets[0].paths[0].threshold = 3
      },
    ],
    [
      'a quorum in one disaster group',
      (p) => {
        p.locations[0].disasterGroup = 'Home city'
        p.locations[1].disasterGroup = 'Home city'
        p.locations[2].disasterGroup = 'Coast'
        p.keys.forEach((k, i) => {
          k.deviceLocationId = p.locations[i].id
          k.backups.forEach((b) => {
            b.locationId = p.locations[i].id
          })
        })
        // The descriptor outside the group, or losing the group's first site takes
        // the wallet on its own and the group says nothing extra.
        p.wallets.forEach((w) => {
          w.configBackups.forEach((c) => {
            c.locationId = p.locations[2].id
          })
        })
      },
    ],
    [
      'a co-signer who can open enough',
      (p) => {
        p.people.push({
          id: 'per_helper',
          label: 'Co-signer 1',
          role: 'cosigner',
          availability: 'days',
          technicalSkill: 'competent',
          knowsPlanExists: true,
          knowsWhereInstructionsAre: true,
          notes: '',
        })
        p.locations.forEach((l) => {
          l.access = [{ personId: 'per_helper', condition: 'always', delayDays: 0 }]
        })
      },
    ],
    [
      'a co-signer who can reach the backups but not spend',
      (p) => {
        p.people.push({
          id: 'per_helper',
          label: 'Co-signer 1',
          role: 'cosigner',
          availability: 'days',
          technicalSkill: 'competent',
          knowsPlanExists: true,
          knowsWhereInstructionsAre: true,
          notes: '',
        })
        p.locations.forEach((l) => {
          l.access = [{ personId: 'per_helper', condition: 'always', delayDays: 0 }]
        })
        // A passphrase they do not have is the something else stopping them.
        p.keys.forEach((k) => {
          k.passphrase = {
            enabled: true,
            storage: 'memorized',
            locationIds: [],
            splitThreshold: null,
            knownBy: [],
          }
        })
      },
    ],
    [
      'material that travels',
      (p) => {
        p.profile.travelsFrequently = true
        p.locations[0].kind = 'on-person'
      },
    ],
    [
      'a successor nobody has confirmed',
      (p) => {
        p.people.forEach((x) => {
          x.availability = 'unknown'
        })
      },
    ],
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

  /**
   * Every rule has had its sentence read by something.
   *
   * The point of the shapes above. Without this the list of them decays: a rule
   * added tomorrow with a sentence nobody ever reads is exactly the rule that
   * turns out to be refused by this program's own guard, or to disagree with
   * its own number. Five sentences were in that state when this was written.
   */
  it('every rule has had its sentence read', () => {
    const fired = new Set<string>()
    for (const [, plan] of [
      ...EXAMPLES.map((example) => ['', example.build()] as [string, Plan]),
      ...shapes(),
    ]) {
      for (const finding of analyze(plan, { today: '2026-03-01' }).findings) {
        fired.add(finding.rule)
      }
    }
    const silent = Object.keys(RULES).filter((id) => !fired.has(id))
    expect(silent, 'add a plan shape that makes these speak').toEqual([])
  })

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
