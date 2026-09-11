import { describe, expect, it } from 'vitest'
import { analyze } from './analyze.ts'
import { baseWorld, evaluateWallet } from './availability.ts'
import {
  createBackup,
  createConfigBackup,
  createDevice,
  createKey,
  createLocation,
  createPerson,
  createPlan,
  createSpendPath,
  createVerification,
  createWallet,
} from '../model/factory.ts'
import type { Plan } from '../model/types.ts'
import { exampleById } from '../model/examples.ts'

const TODAY = '2026-03-01'

function rules(plan: Plan): string[] {
  return analyze(plan, { today: TODAY }).findings.map((finding) => finding.rule)
}

function findingFor(plan: Plan, rule: string) {
  return analyze(plan, { today: TODAY }).findings.find((finding) => finding.rule === rule)
}

/** Two sites, two keys, a 2-of-2 wallet with a descriptor copy at each site. */
function twoOfTwo(overrides: Partial<Plan> = {}): Plan {
  return createPlan({
    locations: [
      createLocation({ id: 'a', label: 'Site A', disasterGroup: 'north' }),
      createLocation({ id: 'b', label: 'Site B', disasterGroup: 'south', travelMinutes: 90 }),
    ],
    devices: [
      createDevice({ id: 'd1', label: 'Signer A', vendor: 'One' }),
      createDevice({ id: 'd2', label: 'Signer B', vendor: 'Two' }),
    ],
    keys: [
      createKey({
        id: 'k1',
        label: 'Key A',
        deviceId: 'd1',
        deviceLocationId: 'a',
        backups: [createBackup({ id: 'b1', locationId: 'a' })],
      }),
      createKey({
        id: 'k2',
        label: 'Key B',
        deviceId: 'd2',
        deviceLocationId: 'b',
        backups: [createBackup({ id: 'b2', locationId: 'b' })],
      }),
    ],
    wallets: [
      createWallet({
        id: 'w',
        label: 'Vault',
        paths: [createSpendPath({ id: 'p', threshold: 2, keyIds: ['k1', 'k2'] })],
        configBackups: [
          createConfigBackup({ id: 'c1', locationId: 'a' }),
          createConfigBackup({ id: 'c2', locationId: 'b' }),
        ],
      }),
    ],
    ...overrides,
  })
}

describe('structure', () => {
  it('refuses to let a multisig exist without its descriptor', () => {
    const plan = twoOfTwo()
    plan.wallets[0] = { ...plan.wallets[0], configBackups: [] }
    expect(rules(plan)).toContain('S010')
  })

  it('sees through a quorum that is really one device', () => {
    const plan = twoOfTwo()
    plan.keys[1] = { ...plan.keys[1], deviceId: 'd1' }
    const finding = findingFor(plan, 'S012')
    expect(finding?.severity).toBe('critical')
    expect(finding?.detail).toContain('2-of-2')
  })

  it('catches a threshold nobody can reach', () => {
    const plan = twoOfTwo()
    plan.wallets[0] = {
      ...plan.wallets[0],
      paths: [createSpendPath({ id: 'p', threshold: 3, keyIds: ['k1', 'k2'] })],
    }
    expect(rules(plan)).toContain('S002')
  })

  it('calls out a passphrase kept with the seed it protects', () => {
    const plan = twoOfTwo()
    plan.keys[0] = {
      ...plan.keys[0],
      passphrase: {
        enabled: true,
        storage: 'written',
        locationIds: ['a'],
        splitThreshold: null,
        knownBy: [],
      },
    }
    expect(rules(plan)).toContain('S014')
  })

  it('calls out a key that exists only on a device', () => {
    const plan = twoOfTwo()
    plan.keys[0] = { ...plan.keys[0], backups: [] }
    expect(rules(plan)).toContain('S006')
  })

  it('says nothing about a wallet configuration when the wallet is single-signature', () => {
    const plan = createPlan({
      locations: [createLocation({ id: 'a' })],
      keys: [createKey({ id: 'k', backups: [createBackup({ id: 'b', locationId: 'a' })] })],
      wallets: [
        createWallet({
          id: 'w',
          tier: 'active',
          stake: 'small',
          paths: [createSpendPath({ id: 'p', threshold: 1, keyIds: ['k'] })],
        }),
      ],
    })
    expect(rules(plan)).not.toContain('S010')
  })
})

describe('loss', () => {
  it('reports a single location that takes a wallet with it', () => {
    const plan = twoOfTwo()
    const finding = findingFor(plan, 'L001')
    expect(finding).toBeDefined()
    expect(finding?.title).toContain('Site A')
  })

  it('reports the absence of spare capacity once, not once per key', () => {
    const plan = twoOfTwo()
    const found = rules(plan).filter((rule) => rule === 'L007')
    expect(found).toHaveLength(1)
    expect(rules(plan)).not.toContain('L002')
  })

  it('reports a disaster group only when it is worse than its members', () => {
    const together = twoOfTwo()
    together.locations = together.locations.map((location) => ({
      ...location,
      disasterGroup: 'one city',
    }))
    // Each site individually already breaks the 2-of-2, so the group adds
    // nothing that has not been said.
    expect(rules(together)).not.toContain('L005')

    const threeOfFour = createPlan({
      locations: [
        createLocation({ id: 'a', label: 'Site A', disasterGroup: 'city' }),
        createLocation({ id: 'b', label: 'Site B', disasterGroup: 'city' }),
        createLocation({ id: 'c', label: 'Site C', disasterGroup: 'coast' }),
      ],
      keys: ['a', 'b', 'c'].map((place, index) =>
        createKey({
          id: `k${index}`,
          label: `Key ${index}`,
          backups: [createBackup({ id: `b${index}`, locationId: place })],
        })
      ),
      wallets: [
        createWallet({
          id: 'w',
          paths: [createSpendPath({ id: 'p', threshold: 2, keyIds: ['k0', 'k1', 'k2'] })],
          configBackups: [createConfigBackup({ id: 'cfg', locationId: 'c' })],
        }),
      ],
    })
    expect(rules(threeOfFour)).toContain('L005')
  })

  it('reports a lone copy of the wallet configuration', () => {
    const plan = twoOfTwo()
    plan.wallets[0] = {
      ...plan.wallets[0],
      configBackups: [createConfigBackup({ id: 'c1', locationId: 'a' })],
    }
    expect(rules(plan)).toContain('L008')
  })
})

describe('compromise', () => {
  it('reports one location that is enough on its own', () => {
    const plan = twoOfTwo()
    // Move Key B's backup next to Key A's.
    plan.keys[1] = {
      ...plan.keys[1],
      backups: [createBackup({ id: 'b2', locationId: 'a' })],
    }
    const finding = findingFor(plan, 'C001')
    expect(finding?.title).toContain('Site A')
    expect(finding?.severity).toBe('critical')
  })

  it('reports a vendor that covers a threshold', () => {
    const plan = twoOfTwo()
    plan.devices[1] = { ...plan.devices[1], vendor: 'One' }
    expect(rules(plan)).toContain('C003')
  })

  it('does not say "1 of the keys were" when there is only one key', () => {
    const plan = twoOfTwo()
    plan.devices = [plan.devices[0]]
    plan.keys = [plan.keys[0]]
    plan.wallets = [
      {
        ...plan.wallets[0],
        paths: [createSpendPath({ id: 'p', threshold: 1, keyIds: ['k1'] })],
      },
    ]
    const finding = findingFor(plan, 'C003')
    // A single-sig plan reaches this rule too, and the sentence written for
    // "3 of the keys" reads as a template leaking when the number is one. The
    // remediation matters more: there is no mix to rebalance with one key.
    expect(finding?.detail).toContain('The one key behind Vault')
    expect(finding?.detail).not.toMatch(/1 of the keys/)
    expect(finding?.remediation).toContain('no mix to change')
  })

  it('reports a person who can already spend', () => {
    const plan = twoOfTwo({
      people: [createPerson({ id: 'p', label: 'Helper 1', role: 'aware' })],
    })
    plan.locations = plan.locations.map((location) => ({
      ...location,
      access: [{ personId: 'p', condition: 'always', delayDays: 0 }],
    }))
    expect(rules(plan)).toContain('C002')
  })

  it('says when the passphrases are buying nothing', () => {
    const plan = twoOfTwo()
    // Everything for both keys, passphrases included, sits at Site A.
    plan.keys = plan.keys.map((key) => ({
      ...key,
      deviceLocationId: 'a',
      backups: [createBackup({ id: `bk-${key.id}`, locationId: 'a' })],
      passphrase: {
        enabled: true,
        storage: 'written' as const,
        locationIds: ['a'],
        splitThreshold: null,
        knownBy: [],
      },
    }))
    expect(rules(plan)).toContain('C006')
  })
})

describe('correlation', () => {
  it('reports a quorum behind one vendor', () => {
    const plan = twoOfTwo()
    plan.devices[1] = { ...plan.devices[1], vendor: 'One' }
    const finding = findingFor(plan, 'R001')
    expect(finding?.detail).toContain('2-of-2')
  })

  it('reports a quorum inside one disaster group', () => {
    const plan = twoOfTwo()
    plan.locations = plan.locations.map((location) => ({ ...location, disasterGroup: 'one city' }))
    expect(rules(plan)).toContain('R003')
  })

  it('stays quiet when the vendors genuinely differ', () => {
    expect(rules(twoOfTwo())).not.toContain('R001')
  })
})

describe('coercion', () => {
  it('reports what one session reaches', () => {
    const plan = twoOfTwo()
    const finding = findingFor(plan, 'X001')
    expect(finding?.severity).toBe('critical')
    expect(finding?.title).toContain('Vault')
  })

  it('stays quiet when a site is beyond the session', () => {
    const plan = twoOfTwo()
    plan.locations[1] = { ...plan.locations[1], travelMinutes: 2000 }
    expect(rules(plan)).not.toContain('X001')
  })

  it('reports a plan with no source of delay at all', () => {
    expect(rules(twoOfTwo())).toContain('X003')
  })
})

describe('succession', () => {
  const withHeir = () =>
    twoOfTwo({
      people: [
        createPerson({
          id: 'h',
          label: 'Successor 1',
          role: 'successor',
          technicalSkill: 'competent',
          knowsPlanExists: true,
          knowsWhereInstructionsAre: true,
        }),
      ],
    })

  it('reports coins nobody can reach after death', () => {
    const plan = withHeir()
    expect(rules(plan)).toContain('U001')
  })

  it('is satisfied once the heir has after-death access to enough', () => {
    const plan = withHeir()
    plan.locations = plan.locations.map((location) => ({
      ...location,
      access: [{ personId: 'h', condition: 'after-death', delayDays: 30 }],
    }))
    expect(rules(plan)).not.toContain('U001')
  })

  it('reports an heir who can already spend today', () => {
    const plan = withHeir()
    plan.locations = plan.locations.map((location) => ({
      ...location,
      access: [{ personId: 'h', condition: 'always', delayDays: 0 }],
    }))
    const found = rules(plan)
    expect(found).toContain('U002')
    // The same fact must not also appear as a generic compromise finding.
    expect(found).not.toContain('C002')
  })

  it('reports an heir who has not been told', () => {
    const plan = withHeir()
    plan.people[0] = { ...plan.people[0], knowsPlanExists: false }
    expect(rules(plan)).toContain('U003')
  })

  it('reports a memorised passphrase as a succession failure', () => {
    const plan = withHeir()
    plan.locations = plan.locations.map((location) => ({
      ...location,
      access: [{ personId: 'h', condition: 'after-death', delayDays: 30 }],
    }))
    plan.keys[0] = {
      ...plan.keys[0],
      passphrase: {
        enabled: true,
        storage: 'memorized',
        locationIds: [],
        splitThreshold: null,
        knownBy: [],
      },
    }
    const finding = findingFor(plan, 'U001')
    expect(finding?.detail).toContain('memorised passphrase')
  })

  it('reports the gap between what an heir must know and must not', () => {
    const plan = withHeir()
    plan.keys[1] = { ...plan.keys[1], backups: [createBackup({ id: 'b2', locationId: 'a' })] }
    plan.locations = plan.locations.map((location) => ({
      ...location,
      access: [{ personId: 'h', condition: 'after-death', delayDays: 10 }],
    }))
    expect(rules(plan)).toContain('U007')
  })
})

describe('staleness', () => {
  it('says once that nothing has been verified, rather than once per object', () => {
    const found = rules(twoOfTwo())
    expect(found.filter((rule) => rule === 'T006')).toHaveLength(1)
    expect(found).not.toContain('T002')
    expect(found).not.toContain('T003')
  })

  it('reports an overdue check', () => {
    const plan = twoOfTwo({
      verifications: [
        createVerification({
          id: 'v',
          kind: 'backup-restore',
          subject: { type: 'key', id: 'k1' },
          lastVerifiedAt: '2024-01-01',
          intervalDays: 365,
        }),
      ],
    })
    const finding = findingFor(plan, 'T001')
    expect(finding?.title).toContain('overdue')
  })

  it('reports what has never been done once something has', () => {
    const plan = twoOfTwo({
      verifications: [
        createVerification({
          id: 'v',
          kind: 'backup-restore',
          subject: { type: 'key', id: 'k1' },
          lastVerifiedAt: '2026-02-01',
          intervalDays: 365,
        }),
      ],
    })
    const found = rules(plan)
    expect(found).not.toContain('T006')
    expect(found).toContain('T003')
  })
})

describe('the worked examples', () => {
  it('the beginner setup fails in the ways it is meant to show', () => {
    const plan = exampleById('one-signer')
    expect(plan).not.toBeNull()
    const found = rules(plan as Plan)
    // One place holds everything: losing it and it being opened are both fatal.
    expect(found).toContain('L001')
    expect(found).toContain('C001')
    expect(found).toContain('S015')
    expect(found).toContain('T006')
  })

  it('the repaired plan closes the findings it was meant to close', () => {
    const before = rules(exampleById('two-of-three') as Plan)
    const after = rules(exampleById('two-of-three-repaired') as Plan)
    // Two sites in one city, and two signers from one vendor.
    expect(before).toContain('R003')
    expect(before).toContain('R001')
    expect(after).not.toContain('R003')
    expect(after).not.toContain('R001')
    // One copy of the descriptor.
    expect(before).toContain('L008')
    expect(after).not.toContain('L008')
    // A successor who did not know where to start.
    expect(before).toContain('U004')
    expect(after).not.toContain('U004')
  })

  it('does not claim the repaired plan is finished', () => {
    const after = analyze(exampleById('two-of-three-repaired') as Plan, { today: TODAY })
    expect(after.findings.length).toBeGreaterThan(0)
  })
})

describe('the report itself', () => {
  it('is ordered worst first', () => {
    const order = ['critical', 'high', 'medium', 'low', 'info']
    const findings = analyze(exampleById('two-of-three') as Plan, { today: TODAY }).findings
    const positions = findings.map((finding) => order.indexOf(finding.severity))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('gives every finding a remediation', () => {
    for (const example of ['one-signer', 'two-of-three', 'two-of-three-repaired']) {
      for (const finding of analyze(exampleById(example) as Plan, { today: TODAY }).findings) {
        expect(finding.remediation.length, `${example} ${finding.rule}`).toBeGreaterThan(20)
        expect(finding.detail.length, `${example} ${finding.rule}`).toBeGreaterThan(20)
      }
    }
  })

  it('gives every finding a stable id', () => {
    const first = analyze(exampleById('two-of-three') as Plan, { today: TODAY }).findings
    const second = analyze(exampleById('two-of-three') as Plan, { today: TODAY }).findings
    expect(first.map((f) => f.id)).toEqual(second.map((f) => f.id))
    expect(new Set(first.map((f) => f.id)).size).toBe(first.length)
  })

  it('says nothing at all about an empty plan', () => {
    expect(analyze(createPlan(), { today: TODAY }).findings).toEqual([])
  })
})

describe('structure, one rule at a time', () => {
  // Each of these is small on purpose: a rule that only fires as part of a
  // large plan is a rule nobody can reason about when it fires on theirs.
  const single = (overrides: Partial<Plan> = {}): Plan =>
    createPlan({
      locations: [createLocation({ id: 'a', label: 'Site A', disasterGroup: 'here' })],
      keys: [
        createKey({
          id: 'k',
          label: 'Key A',
          backups: [createBackup({ id: 'b', locationId: 'a', medium: 'steel' })],
        }),
      ],
      wallets: [
        createWallet({
          id: 'w',
          label: 'Vault',
          paths: [createSpendPath({ id: 'p', threshold: 1, keyIds: ['k'] })],
        }),
      ],
      ...overrides,
    })

  it('S004: a vault on a single key', () => {
    expect(rules(single())).toContain('S004')
  })

  it('S005: a key with neither a device nor a backup', () => {
    const plan = single()
    plan.keys[0] = { ...plan.keys[0], backups: [] }
    expect(rules(plan)).toContain('S005')
  })

  it('S007: paper behind a vault key', () => {
    const plan = single()
    plan.keys[0].backups[0] = { ...plan.keys[0].backups[0], medium: 'paper' }
    expect(rules(plan)).toContain('S007')
  })

  it('S008: key material in an unencrypted file', () => {
    const plan = single()
    plan.keys[0].backups[0] = { ...plan.keys[0].backups[0], medium: 'plain-digital' }
    expect(rules(plan)).toContain('S008')
  })

  it('S009: a backup with no recorded place', () => {
    const plan = single()
    plan.keys[0].backups[0] = { ...plan.keys[0].backups[0], locationId: null }
    expect(rules(plan)).toContain('S009')
  })

  it('S011: a split with fewer shares than its threshold', () => {
    const plan = single()
    plan.keys[0] = {
      ...plan.keys[0],
      backups: [
        createBackup({ id: 's1', locationId: 'a', split: { groupId: 'g', threshold: 3 } }),
        createBackup({ id: 's2', locationId: 'a', split: { groupId: 'g', threshold: 3 } }),
      ],
    }
    expect(rules(plan)).toContain('S011')
  })

  it('S013: a passphrase that exists only in one head', () => {
    const plan = single()
    plan.keys[0] = {
      ...plan.keys[0],
      passphrase: {
        enabled: true,
        storage: 'memorized',
        locationIds: [],
        splitThreshold: null,
        knownBy: [],
      },
    }
    expect(rules(plan)).toContain('S013')
  })

  it('S016: a hot wallet carrying most of it', () => {
    const plan = single()
    plan.wallets[0] = { ...plan.wallets[0], tier: 'hot', stake: 'large' }
    expect(rules(plan)).toContain('S016')
    // Unless it is the decoy, whose whole job is to be handed over.
    plan.wallets[0] = { ...plan.wallets[0], decoy: true }
    expect(rules(plan)).not.toContain('S016')
  })

  it('S017: a co-signer who signs nothing', () => {
    const plan = single({
      people: [createPerson({ id: 'p', label: 'Co-signer 1', role: 'cosigner' })],
    })
    expect(rules(plan)).toContain('S017')
  })

  it('S018: a location with no disaster group, but only once there are two', () => {
    const one = single()
    one.locations[0] = { ...one.locations[0], disasterGroup: null }
    expect(rules(one)).not.toContain('S018')

    const two = single()
    two.locations = [
      { ...two.locations[0], disasterGroup: null },
      createLocation({ id: 'b', label: 'Site B', disasterGroup: null }),
    ]
    expect(rules(two)).toContain('S018')
  })

  it('S019: a PIN written where the device is kept', () => {
    const plan = single({
      devices: [
        createDevice({
          id: 'd',
          label: 'Signer A',
          pin: { storage: 'written', locationId: 'a', knownBy: [] },
        }),
      ],
    })
    plan.keys[0] = { ...plan.keys[0], deviceId: 'd', deviceLocationId: 'a' }
    expect(rules(plan)).toContain('S019')
  })

  it('S020: a wallet with no path that opens today', () => {
    const plan = single()
    plan.wallets[0] = {
      ...plan.wallets[0],
      paths: [
        createSpendPath({
          id: 'p',
          label: 'Inheritance',
          kind: 'inheritance',
          threshold: 1,
          keyIds: ['k'],
          timelockDays: 180,
        }),
      ],
    }
    expect(rules(plan)).toContain('S020')
  })

  it('S001 and S003: a wallet with nothing behind it', () => {
    const empty = single()
    empty.wallets[0] = { ...empty.wallets[0], paths: [] }
    expect(rules(empty)).toContain('S001')

    const pathless = single()
    pathless.wallets[0] = {
      ...pathless.wallets[0],
      paths: [createSpendPath({ id: 'p', threshold: 1, keyIds: [] })],
    }
    expect(rules(pathless)).toContain('S003')
  })
})

describe('the rules that need a particular shape to fire', () => {
  it('C005: an unlocked device where someone else can walk in', () => {
    const plan = twoOfTwo({
      people: [createPerson({ id: 'p', label: 'Housemate 1', role: 'aware' })],
    })
    plan.locations[0] = {
      ...plan.locations[0],
      access: [{ personId: 'p', condition: 'always', delayDays: 0 }],
    }
    plan.devices[0] = {
      ...plan.devices[0],
      pin: { storage: 'none', locationId: null, knownBy: [] },
    }
    const finding = findingFor(plan, 'C005')
    expect(finding?.title).toContain('Signer A')
    expect(finding?.detail).toContain('Housemate 1')
  })

  it('R002: one architecture across two makers', () => {
    const plan = twoOfTwo()
    plan.devices = plan.devices.map((device) => ({ ...device, architecture: 'Chip family Q' }))
    const found = rules(plan)
    expect(found).toContain('R002')
    // And not R001, because the makers genuinely differ. Saying both would be
    // the same fact twice.
    expect(found).not.toContain('R001')
  })

  it('R004: one person reaching a quorum of backups without being able to spend', () => {
    const plan = twoOfTwo({
      people: [createPerson({ id: 'p', label: 'Helper 1', role: 'aware' })],
    })
    // They can reach both backups, and cannot spend, because the descriptor is
    // somewhere they cannot go.
    plan.keys = plan.keys.map((key) => ({
      ...key,
      deviceId: null,
      deviceLocationId: null,
      backups: [createBackup({ id: `bk-${key.id}`, locationId: 'a' })],
    }))
    plan.locations[0] = {
      ...plan.locations[0],
      access: [{ personId: 'p', condition: 'always', delayDays: 0 }],
    }
    plan.wallets[0] = {
      ...plan.wallets[0],
      configBackups: [createConfigBackup({ id: 'c', locationId: 'b' })],
    }
    const found = rules(plan)
    expect(found).toContain('R004')
    expect(found).not.toContain('C002')
  })

  it('R005: every device down one supply route', () => {
    const plan = twoOfTwo()
    plan.devices = plan.devices.map((device) => ({
      ...device,
      supplyChain: 'second-hand' as const,
    }))
    expect(rules(plan)).toContain('R005')
    plan.devices = plan.devices.map((device) => ({
      ...device,
      supplyChain: 'direct-from-vendor' as const,
    }))
    expect(rules(plan)).not.toContain('R005')
  })

  it('X004: coercion is a stated concern and nothing is expendable', () => {
    const plan = twoOfTwo()
    plan.profile = { ...plan.profile, concerns: ['coercion'] }
    expect(rules(plan)).toContain('X004')
    plan.wallets = [
      ...plan.wallets,
      createWallet({
        id: 'decoy',
        label: 'Pocket',
        tier: 'hot',
        stake: 'small',
        decoy: true,
        paths: [createSpendPath({ id: 'dp', threshold: 1, keyIds: ['k1'] })],
      }),
    ]
    expect(rules(plan)).not.toContain('X004')
  })
})

describe('the fields the interface asks about are the fields the engine uses', () => {
  // Each of these was collected by the interface, explained in help text, and
  // then ignored. A question a program does not use is worse than one it does
  // not ask.

  it('S021: the horizon decides which media are viable', () => {
    const plan = twoOfTwo()
    plan.profile = { ...plan.profile, horizonYears: 40 }
    plan.keys = plan.keys.map((key) => ({
      ...key,
      backups: [createBackup({ id: `p-${key.id}`, medium: 'paper', locationId: 'a' })],
    }))
    expect(rules(plan)).toContain('S021')

    // Steel is the point of steel.
    plan.keys = plan.keys.map((key) => ({
      ...key,
      backups: [createBackup({ id: `s-${key.id}`, medium: 'steel', locationId: 'a' })],
    }))
    expect(rules(plan)).not.toContain('S021')

    // And a five-year plan is not making a thirty-year bet.
    plan.profile = { ...plan.profile, horizonYears: 5 }
    plan.keys = plan.keys.map((key) => ({
      ...key,
      backups: [createBackup({ id: `p2-${key.id}`, medium: 'paper', locationId: 'a' })],
    }))
    expect(rules(plan)).not.toContain('S021')
  })

  it('S022: the horizon decides whether a company is a safe dependency', () => {
    const plan = twoOfTwo({
      people: [createPerson({ id: 'svc', label: 'Key agent 1', role: 'key-agent' })],
    })
    plan.profile = { ...plan.profile, horizonYears: 30 }
    plan.keys[1] = { ...plan.keys[1], heldBy: 'svc' }
    expect(rules(plan)).toContain('S022')

    plan.profile = { ...plan.profile, horizonYears: 5 }
    expect(rules(plan)).not.toContain('S022')
  })

  it('R006: one jurisdiction is one container, however far apart the buildings are', () => {
    const plan = twoOfTwo()
    plan.profile = { ...plan.profile, concerns: ['legal-seizure'], jurisdictionCount: 1 }
    expect(rules(plan)).toContain('R006')

    plan.profile = { ...plan.profile, jurisdictionCount: 2 }
    expect(rules(plan)).not.toContain('R006')
  })

  it('X005: material that travels is material distance does not protect', () => {
    const plan = twoOfTwo()
    plan.profile = { ...plan.profile, travelsFrequently: true }
    plan.locations[1] = { ...plan.locations[1], kind: 'on-person' }
    expect(rules(plan)).toContain('X005')

    plan.profile = { ...plan.profile, travelsFrequently: false }
    expect(rules(plan)).not.toContain('X005')
  })

  it('U008: a successor whose availability nobody has asked about', () => {
    const plan = twoOfTwo({
      people: [
        createPerson({
          id: 'h',
          label: 'Successor 1',
          role: 'successor',
          knowsPlanExists: true,
          knowsWhereInstructionsAre: true,
          availability: 'unknown',
        }),
      ],
    })
    expect(rules(plan)).toContain('U008')

    plan.people[0] = { ...plan.people[0], availability: 'days' }
    expect(rules(plan)).not.toContain('U008')
  })
})

describe('two mistakes that look like good practice', () => {
  it('S023: a key reused between a hot wallet and a vault', () => {
    // The two-of-three example ships with exactly this: Key A signs the vault
    // and is also the whole of the phone wallet.
    const found = rules(exampleById('two-of-three') as Plan)
    expect(found).toContain('S023')

    const plan = twoOfTwo()
    plan.wallets = [
      ...plan.wallets,
      createWallet({
        id: 'hot',
        label: 'Phone',
        tier: 'hot',
        stake: 'small',
        paths: [createSpendPath({ id: 'hp', threshold: 1, keyIds: ['k1'] })],
      }),
    ]
    const finding = findingFor(plan, 'S023')
    expect(finding?.title).toContain('Phone')
    expect(finding?.title).toContain('Vault')

    // A separate key for the phone is the fix, and it closes the finding.
    plan.keys = [...plan.keys, createKey({ id: 'k3', label: 'Key C' })]
    plan.wallets[plan.wallets.length - 1] = {
      ...plan.wallets[plan.wallets.length - 1],
      paths: [createSpendPath({ id: 'hp', threshold: 1, keyIds: ['k3'] })],
    }
    expect(rules(plan)).not.toContain('S023')
  })

  it('C007: a descriptor is not a secret, and it is a permanent view', () => {
    const plan = twoOfTwo({
      people: [createPerson({ id: 'law', label: 'Professional 1', role: 'professional' })],
    })
    plan.locations[1] = {
      ...plan.locations[1],
      access: [{ personId: 'law', condition: 'always', delayDays: 0 }],
    }
    const finding = findingFor(plan, 'C007')
    expect(finding?.title).toContain('Professional 1')
    expect(finding?.detail).toContain('cannot spend')

    // Access that only opens after death is not a live view of the balance.
    plan.locations[1] = {
      ...plan.locations[1],
      access: [{ personId: 'law', condition: 'after-death', delayDays: 30 }],
    }
    expect(rules(plan)).not.toContain('C007')
  })
})

describe('one device signing for more than one key', () => {
  const twoOfThree = () => structuredClone(exampleById('two-of-three')!)

  it('is critical when that device holds the whole threshold', () => {
    const plan = twoOfThree()
    // 2-of-3 with two of its keys on one device: whoever holds the device
    // spends the wallet, so the threshold is a costume.
    plan.keys[1].deviceId = plan.keys[0].deviceId
    const found = analyze(plan, { today: '2026-03-01' }).findings.filter((f) => f.rule === 'S012')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('critical')
    expect(found[0].detail).toContain('costume')
  })

  it('is high, and says what the real requirement is, when it holds part of it', () => {
    const plan = twoOfThree()
    // Not a vault holding most of the stack, because that is escalated a step
    // and the point here is the step below critical.
    plan.wallets[0].tier = 'active'
    plan.wallets[0].stake = 'small'
    // 3-of-5 with two keys on one device is really 2-of-4. Calling that a
    // quorum that does not exist would be confidently wrong.
    // Their own devices, or the one device would hold four of the five and be
    // the other case.
    plan.devices.push(
      { ...structuredClone(plan.devices[0]), id: 'dev_d', label: 'Signer D' },
      { ...structuredClone(plan.devices[0]), id: 'dev_e', label: 'Signer E' }
    )
    const spare = structuredClone(plan.keys[0])
    plan.keys.push({ ...spare, id: 'key_d', label: 'Key D', deviceId: 'dev_d' })
    plan.keys.push({ ...spare, id: 'key_e', label: 'Key E', deviceId: 'dev_e' })
    plan.wallets[0].paths[0] = {
      ...plan.wallets[0].paths[0],
      threshold: 3,
      keyIds: ['key_a', 'key_b', 'key_c', 'key_d', 'key_e'],
    }
    plan.keys[1].deviceId = plan.keys[0].deviceId
    const found = analyze(plan, { today: '2026-03-01' }).findings.filter((f) => f.rule === 'S012')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('high')
    expect(found[0].detail).toContain('2 independent decisions')
    expect(found[0].detail).not.toContain('costume')
  })
})

describe('a key somebody else holds', () => {
  const collaborative = () => {
    const plan = structuredClone(exampleById('two-of-three')!)
    plan.people[0] = {
      ...plan.people[0],
      id: 'per_provider',
      label: 'The provider',
      role: 'key-agent',
    }
    plan.locations = plan.locations.map((location) => ({
      ...location,
      access: [],
      custodianId: null,
    }))
    plan.keys[2] = {
      ...plan.keys[2],
      heldBy: 'per_provider',
      deviceId: null,
      deviceLocationId: null,
      backups: [],
    }
    return plan
  }

  it("is never told to write the holder's key down", () => {
    const findings = analyze(collaborative(), { today: '2026-03-01' }).findings
    const about = findings.filter((f) => f.subjects.some((s) => s.id === 'key_c'))
    // S005 and S006 reason about the objects behind a key. For a held key those
    // objects are the holder's, and "write Key C down on a durable medium" is
    // advice the customer cannot follow and that would defeat the arrangement.
    expect(about.map((f) => f.rule)).not.toContain('S005')
    expect(about.map((f) => f.rule)).not.toContain('S006')
    for (const finding of findings) {
      expect(finding.remediation).not.toMatch(/write key c down/i)
    }
  })

  it('says instead that the redundancy behind it cannot be seen from here', () => {
    const findings = analyze(collaborative(), { today: '2026-03-01' }).findings
    const held = findings.find((f) => f.rule === 'S025')
    expect(held).toBeDefined()
    expect(held?.title).toBe('Key C is held by The provider')
    expect(held?.detail).toMatch(/their backup regime/i)
    // And the way out is a path that does not need them, not a copy of theirs.
    expect(held?.remediation).toMatch(/does not need them/i)
  })

  it('signs with it today, and stops when the holder will not', () => {
    const plan = collaborative()
    // The customer holds one of three and the provider holds two, so the
    // wallet works today and nothing moves without them.
    plan.keys[1] = { ...plan.keys[1], heldBy: 'per_provider', deviceId: null, backups: [] }

    // It used to read as unspendable today, because a key with a holder and no
    // recorded device or backup had no route at all. That is the opposite of
    // what the arrangement does: the provider signs with their own key, behind
    // their own door, and none of that belongs in this plan.
    const today = evaluateWallet(plan, plan.wallets[0], baseWorld(plan))
    expect(today.spendable).toBe(true)
    expect(today.margin).toBe(1)

    // And the dependency is reported as what it is.
    expect(analyze(plan, { today: '2026-03-01' }).findings.map((f) => f.rule)).toContain('L006')
  })
})
