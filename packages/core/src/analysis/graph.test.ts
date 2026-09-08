import { describe, expect, it } from 'vitest'
import { baseWorld, without } from './availability.ts'
import { buildGraph, LAYER } from './graph.ts'
import { recoveryTiming, describeDuration } from './timing.ts'
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

/**
 * A 2-of-3 with one key per site, a steel backup beside each device, and one
 * configuration copy. Site C is five hours away, which is what makes it useful
 * for the timing tests as well as the graph ones.
 */
function twoOfThree(overrides: Partial<Plan> = {}): Plan {
  return createPlan({
    locations: [
      createLocation({ id: 'a', label: 'Site A', travelMinutes: 0, disasterGroup: 'home' }),
      createLocation({ id: 'b', label: 'Site B', travelMinutes: 40, disasterGroup: 'home' }),
      createLocation({ id: 'c', label: 'Site C', travelMinutes: 300, disasterGroup: 'coast' }),
    ],
    devices: [
      createDevice({ id: 'd1', label: 'Signer A' }),
      createDevice({ id: 'd2', label: 'Signer B' }),
      createDevice({ id: 'd3', label: 'Signer C' }),
    ],
    keys: [
      createKey({
        id: 'k1',
        label: 'Key A',
        deviceId: 'd1',
        deviceLocationId: 'a',
        backups: [createBackup({ id: 'b1', label: 'Key A / Steel', locationId: 'a' })],
      }),
      createKey({
        id: 'k2',
        label: 'Key B',
        deviceId: 'd2',
        deviceLocationId: 'b',
        backups: [createBackup({ id: 'b2', label: 'Key B / Steel', locationId: 'b' })],
      }),
      createKey({
        id: 'k3',
        label: 'Key C',
        deviceId: 'd3',
        deviceLocationId: 'c',
        backups: [createBackup({ id: 'b3', label: 'Key C / Steel', locationId: 'c' })],
      }),
    ],
    wallets: [
      createWallet({
        id: 'w',
        label: 'Vault',
        paths: [createSpendPath({ id: 'p', threshold: 2, keyIds: ['k1', 'k2', 'k3'] })],
        configBackups: [createConfigBackup({ id: 'cfg', label: 'Descriptor', locationId: 'a' })],
      }),
    ],
    ...overrides,
  })
}

describe('the graph', () => {
  it('runs from the wallet through to the places it rests on', () => {
    const plan = twoOfThree()
    const graph = buildGraph(plan, baseWorld(plan))
    const kinds = new Set(graph.nodes.map((node) => node.kind))
    expect([...kinds].sort()).toEqual([
      'backup',
      'config',
      'device',
      'key',
      'path',
      'place',
      'wallet',
    ])
    expect(graph.layers).toEqual([LAYER.wallet, LAYER.path, LAYER.key, LAYER.device, LAYER.place])
  })

  it('draws the chain rather than a list: wallet to path to key to device to place', () => {
    const plan = twoOfThree()
    const graph = buildGraph(plan, baseWorld(plan))
    const has = (from: string, to: string) =>
      graph.edges.some((edge) => edge.from === from && edge.to === to)
    expect(has('wallet:w', 'path:p')).toBe(true)
    expect(has('path:p', 'key:k1')).toBe(true)
    expect(has('key:k1', 'device:d1')).toBe(true)
    expect(has('device:d1', 'place:a')).toBe(true)
    expect(has('wallet:w', 'config:cfg')).toBe(true)
  })

  it('agrees with the findings about what is out of reach', () => {
    const plan = twoOfThree()
    const graph = buildGraph(plan, without(baseWorld(plan), { locations: ['c'] }))
    const node = (id: string) => graph.nodes.find((entry) => entry.id === id)!
    expect(node('place:c').available).toBe(false)
    expect(node('key:k3').available).toBe(false)
    expect(node('key:k1').available).toBe(true)
    // Two of three keys remain, so the wallet itself still spends.
    expect(node('wallet:w').available).toBe(true)
  })

  it('marks an edge dead when either end of it is', () => {
    const plan = twoOfThree()
    const graph = buildGraph(plan, without(baseWorld(plan), { locations: ['c'] }))
    const edge = (id: string) => graph.edges.find((entry) => entry.id === id)!
    expect(edge('key:k3->device:d3').live).toBe(false)
    expect(edge('key:k1->device:d1').live).toBe(true)
  })

  it('says when a multisig has no configuration copy at all', () => {
    const plan = twoOfThree()
    plan.wallets[0] = { ...plan.wallets[0], configBackups: [] }
    const graph = buildGraph(plan, baseWorld(plan))
    const missing = graph.nodes.find((node) => node.kind === 'config')!
    expect(missing.available).toBe(false)
    expect(missing.blocker).toContain('not written down')
  })

  it('narrows to one wallet and drops the places it does not touch', () => {
    const plan = twoOfThree({
      wallets: [
        createWallet({
          id: 'w',
          label: 'Vault',
          paths: [createSpendPath({ id: 'p', threshold: 2, keyIds: ['k1', 'k2', 'k3'] })],
        }),
        createWallet({
          id: 'hot',
          label: 'Daily',
          paths: [createSpendPath({ id: 'ph', threshold: 1, keyIds: ['k1'] })],
        }),
      ],
    })
    const graph = buildGraph(plan, baseWorld(plan), { walletId: 'hot' })
    expect(graph.nodes.filter((node) => node.kind === 'place').map((node) => node.id)).toEqual([
      'place:a',
    ])
  })

  it('shows who can open a door, and when', () => {
    const plan = twoOfThree({ people: [createPerson({ id: 'p1', label: 'Successor 1' })] })
    plan.locations[1] = {
      ...plan.locations[1],
      access: [{ personId: 'p1', condition: 'after-death', delayDays: 60 }],
    }
    const graph = buildGraph(plan, baseWorld(plan))
    const edge = graph.edges.find((entry) => entry.id === 'place:b->person:p1')!
    // The edge label has one column gap to fit in, so the condition goes on the
    // line and the wait goes on the person it belongs to.
    expect(edge.label).toBe('after you')
    const person = graph.nodes.find((node) => node.id === 'person:p1')!
    expect(person.detail).toBe('successor · waits 60d')
  })
})

describe('how long a recovery takes', () => {
  it('goes to the two nearest places, not all three', () => {
    const plan = twoOfThree()
    const timing = recoveryTiming(plan, plan.wallets[0], baseWorld(plan))
    expect(timing.possible).toBe(true)
    // Site A is here and Site B is 40 minutes away. Site C is not needed.
    expect(timing.placeIds.sort()).toEqual(['a', 'b'])
    expect(timing.travelMinutes).toBe(80)
    expect(timing.days).toBe(1)
  })

  it('counts a place once however many things are collected there', () => {
    const plan = twoOfThree()
    // Both of the two nearest keys now live at Site B.
    plan.keys[0] = { ...plan.keys[0], deviceLocationId: 'b' }
    plan.keys[0] = {
      ...plan.keys[0],
      backups: [createBackup({ id: 'b1', locationId: 'b' })],
    }
    plan.wallets[0] = {
      ...plan.wallets[0],
      configBackups: [createConfigBackup({ id: 'cfg', locationId: 'b' })],
    }
    const timing = recoveryTiming(plan, plan.wallets[0], baseWorld(plan))
    expect(timing.placeIds).toEqual(['b'])
    expect(timing.travelMinutes).toBe(80)
  })

  it('has to go to Site C once Site B is gone, and says so in days', () => {
    const plan = twoOfThree()
    const timing = recoveryTiming(
      plan,
      plan.wallets[0],
      without(baseWorld(plan), { locations: ['b'] })
    )
    expect(timing.placeIds.sort()).toEqual(['a', 'c'])
    // Ten hours of driving, both ways, is more than one day of travel.
    expect(timing.travelMinutes).toBe(600)
    expect(timing.days).toBe(2)
  })

  it('waits for a timelock rather than adding it to the travelling', () => {
    const plan = twoOfThree()
    plan.wallets[0] = {
      ...plan.wallets[0],
      paths: [createSpendPath({ id: 'p', threshold: 2, keyIds: ['k1', 'k2'], timelockDays: 180 })],
    }
    const world = { ...baseWorld(plan), elapsedDays: 365 }
    const timing = recoveryTiming(plan, plan.wallets[0], world)
    // 180 days of waiting, then one day of driving. Not 181 separate days of
    // each, and not 180 alone.
    expect(timing.days).toBe(181)
    expect(timing.steps[0].part).toBe('wait')
  })

  it('reports a place with no recorded distance as an unknown instead of guessing', () => {
    const plan = twoOfThree()
    plan.locations[1] = { ...plan.locations[1], travelMinutes: null }
    const timing = recoveryTiming(plan, plan.wallets[0], baseWorld(plan))
    expect(timing.unknowns.join(' ')).toContain('Site B')
  })

  it('says nothing at all about a wallet that cannot be recovered', () => {
    const plan = twoOfThree()
    const world = without(baseWorld(plan), { locations: ['a', 'b', 'c'] })
    expect(recoveryTiming(plan, plan.wallets[0], world).possible).toBe(false)
  })

  it('describes a duration the way a person would say it', () => {
    expect(describeDuration(0, 0)).toBe('same day, no travel')
    expect(describeDuration(1, 80)).toBe('about a day')
    expect(describeDuration(21, 0)).toBe('about 3 weeks')
  })
})
