import { describe, expect, it } from 'vitest'
import {
  baseWorld,
  configAvailable,
  evaluateKey,
  evaluateWallet,
  usableKeys,
  without,
} from './availability.ts'
import {
  createBackup,
  createConfigBackup,
  createDevice,
  createKey,
  createLocation,
  createPerson,
  createPlan,
  createSpendPath,
  createWallet,
} from '../model/factory.ts'
import type { Plan } from '../model/types.ts'

/** A 2-of-3 with one key per site and a steel backup beside each device. */
function twoOfThree(overrides: Partial<Plan> = {}): Plan {
  return createPlan({
    locations: [
      createLocation({ id: 'a', label: 'Site A', disasterGroup: 'one' }),
      createLocation({ id: 'b', label: 'Site B', disasterGroup: 'two' }),
      createLocation({ id: 'c', label: 'Site C', disasterGroup: 'three' }),
    ],
    devices: [
      createDevice({ id: 'd1', label: 'Signer A', storesWalletConfig: true }),
      createDevice({ id: 'd2', label: 'Signer B' }),
      createDevice({ id: 'd3', label: 'Signer C' }),
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
      createKey({
        id: 'k3',
        label: 'Key C',
        deviceId: 'd3',
        deviceLocationId: 'c',
        backups: [createBackup({ id: 'b3', locationId: 'c' })],
      }),
    ],
    wallets: [
      createWallet({
        id: 'w',
        label: 'Vault',
        paths: [createSpendPath({ id: 'p', threshold: 2, keyIds: ['k1', 'k2', 'k3'] })],
        configBackups: [createConfigBackup({ id: 'cfg', locationId: 'a' })],
      }),
    ],
    ...overrides,
  })
}

describe('a key is usable', () => {
  it('through its device', () => {
    const plan = twoOfThree()
    const world = without(baseWorld(plan), { objects: ['b1'] })
    expect(evaluateKey(plan, plan.keys[0], world).routes).toEqual(['device'])
  })

  it('through its backup when the device is gone', () => {
    const plan = twoOfThree()
    const world = without(baseWorld(plan), { objects: ['d1'] })
    expect(evaluateKey(plan, plan.keys[0], world).routes).toEqual(['backup'])
  })

  it('through neither when the whole location is gone', () => {
    const plan = twoOfThree()
    const world = without(baseWorld(plan), { locations: ['a'] })
    const state = evaluateKey(plan, plan.keys[0], world)
    expect(state.usable).toBe(false)
    expect(state.blockers.join(' ')).toContain('Key A')
  })
})

describe('PINs', () => {
  it('a memorised PIN is unavailable once memory is', () => {
    const plan = twoOfThree()
    const world = { ...baseWorld(plan), memory: false }
    // The backup route still works: a written seed does not need the PIN.
    expect(evaluateKey(plan, plan.keys[0], world).routes).toEqual(['backup'])
  })

  it('a device with no PIN is usable by anyone holding it', () => {
    const plan = twoOfThree()
    plan.devices[0] = {
      ...plan.devices[0],
      pin: { storage: 'none', locationId: null, knownBy: [] },
    }
    plan.keys[0] = { ...plan.keys[0], backups: [] }
    const world = { ...baseWorld(plan), memory: false }
    expect(evaluateKey(plan, plan.keys[0], world).usable).toBe(true)
  })

  it('a written PIN is available to whoever can reach where it is written', () => {
    const plan = twoOfThree()
    plan.devices[0] = {
      ...plan.devices[0],
      pin: { storage: 'written', locationId: 'b', knownBy: [] },
    }
    plan.keys[0] = { ...plan.keys[0], backups: [] }
    const withoutSiteB = { ...baseWorld(plan), memory: false, reachable: new Set(['a']) }
    expect(evaluateKey(plan, plan.keys[0], withoutSiteB).usable).toBe(false)
    const withSiteB = { ...baseWorld(plan), memory: false, reachable: new Set(['a', 'b']) }
    expect(evaluateKey(plan, plan.keys[0], withSiteB).usable).toBe(true)
  })
})

describe('passphrases', () => {
  it('a memorised passphrase does not survive the person who memorised it', () => {
    const plan = twoOfThree()
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
    const afterDeath = { ...baseWorld(plan), memory: false }
    expect(evaluateKey(plan, plan.keys[0], afterDeath).usable).toBe(false)
    expect(evaluateKey(plan, plan.keys[1], afterDeath).usable).toBe(true)
  })

  it('gates the device route as well as the backup route', () => {
    const plan = twoOfThree()
    plan.keys[0] = {
      ...plan.keys[0],
      backups: [],
      passphrase: {
        enabled: true,
        storage: 'written',
        locationIds: ['c'],
        splitThreshold: null,
        knownBy: [],
      },
    }
    // Holding the device and its location is not enough without the passphrase.
    const world = { ...baseWorld(plan), memory: false, reachable: new Set(['a']) }
    expect(evaluateKey(plan, plan.keys[0], world).usable).toBe(false)
  })

  it('a split passphrase needs its threshold of places', () => {
    const plan = twoOfThree()
    plan.keys[0] = {
      ...plan.keys[0],
      passphrase: {
        enabled: true,
        storage: 'split',
        locationIds: ['a', 'b', 'c'],
        splitThreshold: 2,
        knownBy: [],
      },
    }
    const one = { ...baseWorld(plan), memory: false, reachable: new Set(['a']) }
    expect(evaluateKey(plan, plan.keys[0], one).usable).toBe(false)
    const two = { ...baseWorld(plan), memory: false, reachable: new Set(['a', 'b']) }
    expect(evaluateKey(plan, plan.keys[0], two).usable).toBe(true)
  })
})

describe('split backups', () => {
  it('need a threshold of shares to rebuild the key', () => {
    const plan = twoOfThree()
    plan.keys[0] = {
      ...plan.keys[0],
      deviceId: null,
      deviceLocationId: null,
      backups: [
        createBackup({ id: 's1', locationId: 'a', split: { groupId: 'g', threshold: 2 } }),
        createBackup({ id: 's2', locationId: 'b', split: { groupId: 'g', threshold: 2 } }),
        createBackup({ id: 's3', locationId: 'c', split: { groupId: 'g', threshold: 2 } }),
      ],
    }
    const one = { ...baseWorld(plan), reachable: new Set(['a']) }
    expect(evaluateKey(plan, plan.keys[0], one).usable).toBe(false)
    const two = { ...baseWorld(plan), reachable: new Set(['a', 'c']) }
    expect(evaluateKey(plan, plan.keys[0], two).usable).toBe(true)
  })
})

describe('a wallet is spendable', () => {
  it('when the threshold is met and the configuration is reachable', () => {
    const plan = twoOfThree()
    const result = evaluateWallet(plan, plan.wallets[0], baseWorld(plan))
    expect(result.spendable).toBe(true)
    expect(result.margin).toBe(1)
  })

  it('not when one key short', () => {
    const plan = twoOfThree()
    const world = without(baseWorld(plan), { locations: ['b', 'c'] })
    const result = evaluateWallet(plan, plan.wallets[0], world)
    expect(result.spendable).toBe(false)
    expect(result.blockers.join(' ')).toContain('1 key short')
  })

  it('not when the descriptor is unreachable, however many seeds are in hand', () => {
    const plan = twoOfThree()
    // Every key is available; only the configuration copy is gone, and the one
    // device that stores it is gone with it.
    const world = without(baseWorld(plan), { objects: ['cfg', 'd1'] })
    const result = evaluateWallet(plan, plan.wallets[0], world)
    expect(result.spendable).toBe(false)
    expect(result.blockers).toContain('the wallet configuration cannot be recovered')
  })

  it('when a signer that stores the configuration is still in hand', () => {
    const plan = twoOfThree()
    const world = without(baseWorld(plan), { objects: ['cfg'] })
    expect(configAvailable(plan, plan.wallets[0], world)).toBe(true)
  })

  it('a single-signature wallet needs no configuration backup', () => {
    const plan = createPlan({
      keys: [createKey({ id: 'k', backups: [createBackup({ id: 'b', locationId: 'a' })] })],
      locations: [createLocation({ id: 'a' })],
      wallets: [
        createWallet({
          id: 'w',
          paths: [createSpendPath({ id: 'p', threshold: 1, keyIds: ['k'] })],
        }),
      ],
    })
    expect(evaluateWallet(plan, plan.wallets[0], baseWorld(plan)).spendable).toBe(true)
  })
})

describe('timelocked paths', () => {
  const plan = createPlan({
    locations: [createLocation({ id: 'a' })],
    keys: [
      createKey({ id: 'k1', backups: [createBackup({ id: 'b1', locationId: 'a' })] }),
      createKey({ id: 'k2', backups: [createBackup({ id: 'b2', locationId: 'a' })] }),
    ],
    wallets: [
      createWallet({
        id: 'w',
        paths: [
          createSpendPath({ id: 'now', threshold: 2, keyIds: ['k1', 'k2'] }),
          createSpendPath({
            id: 'later',
            label: 'Inheritance',
            kind: 'inheritance',
            threshold: 1,
            keyIds: ['k2'],
            timelockDays: 180,
          }),
        ],
        configBackups: [createConfigBackup({ id: 'cfg', locationId: 'a' })],
      }),
    ],
  })

  it('are closed until the time has passed', () => {
    const world = without(baseWorld(plan), { objects: ['k1'] })
    const result = evaluateWallet(plan, plan.wallets[0], world)
    expect(result.spendable).toBe(false)
    expect(result.blockers).toEqual(['Everyday is 1 key short', 'Inheritance has not unlocked yet'])
  })

  it('open once it has', () => {
    const world = { ...without(baseWorld(plan), { objects: ['k1'] }), elapsedDays: 200 }
    const result = evaluateWallet(plan, plan.wallets[0], world)
    expect(result.spendable).toBe(true)
    expect(result.viaPathId).toBe('later')
  })
})

describe('keys held by other people', () => {
  it('are unusable when that person is not cooperating', () => {
    const plan = twoOfThree({
      people: [createPerson({ id: 'p1', label: 'Co-signer 1', role: 'cosigner' })],
    })
    plan.keys[2] = { ...plan.keys[2], heldBy: 'p1' }
    const world = without(baseWorld(plan), { people: ['p1'] })
    expect(usableKeys(plan, world).map((key) => key.id)).toEqual(['k1', 'k2'])
  })
})

describe('unknown placement', () => {
  it('counts as reachable for the user and not for somebody in one room', () => {
    const plan = twoOfThree()
    plan.keys[0] = { ...plan.keys[0], deviceLocationId: null, backups: [] }
    const mine = baseWorld(plan)
    expect(evaluateKey(plan, plan.keys[0], mine).usable).toBe(true)
    const theirs = {
      ...baseWorld(plan),
      unknownPlacementReachable: false,
      reachable: new Set(['a']),
    }
    expect(evaluateKey(plan, plan.keys[0], theirs).usable).toBe(false)
  })
})
