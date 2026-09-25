import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultShape, planFromShape } from '@outlive/core'
import { useStore } from '@/lib/store.ts'
import { registerAgentTools } from './register.ts'
import { takeAgentKnockouts } from './tools.ts'

interface Registered {
  name: string
  execute: (input: unknown) => Promise<unknown>
  annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean }
}

let tools: Map<string, Registered>
let signals: AbortSignal[]
let stop: () => void

function call(name: string, input: unknown = {}) {
  const tool = tools.get(name)
  if (!tool) throw new Error(`${name} was not registered`)
  return tool.execute(input) as Promise<Record<string, unknown> & unknown[]>
}

function plan() {
  const state = useStore.getState()
  return state.plans.find((entry) => entry.id === state.activeId)!
}

beforeEach(() => {
  tools = new Map()
  signals = []
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: {
      registerTool(tool: Registered, options: { signal: AbortSignal }) {
        tools.set(tool.name, tool)
        signals.push(options.signal)
      },
    },
  })
  useStore.setState({ ready: false, plans: [], activeId: '', past: [], future: [], toast: null })
  useStore.getState().hydrate()
  useStore.getState().addPlan(planFromShape(defaultShape()))
  stop = registerAgentTools()
})

afterEach(() => {
  stop()
  delete (document as unknown as { modelContext?: unknown }).modelContext
})

describe('the WebMCP tools', () => {
  it('registers every tool with the browser and takes them back with one signal', () => {
    expect(tools.size).toBeGreaterThanOrEqual(10)
    for (const name of tools.keys()) expect(name).toMatch(/^outlive_[a-z_]+$/)
    stop()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('marks every tool that changes the plan as consequential, and none that only read', () => {
    const changing = [
      'outlive_apply_fix',
      'outlive_apply_template',
      'outlive_place',
      'outlive_set_threshold',
      'outlive_build_plan',
      'outlive_undo',
    ]
    for (const name of changing) expect(tools.get(name)?.annotations?.consequentialHint).toBe(true)
    for (const name of ['outlive_get_plan', 'outlive_list_findings', 'outlive_list_worlds'])
      expect(tools.get(name)?.annotations?.readOnlyHint).toBe(true)
  })

  it('reads the plan by labels, with no identifiers or notes', async () => {
    const summary = await call('outlive_get_plan')
    expect(summary.wallets).toHaveLength(1)
    expect(JSON.stringify(summary)).not.toMatch(/"id"|notes/)
    const wallet = (summary.wallets as { paths: { threshold: number; keys: string[] }[] }[])[0]
    expect(wallet.paths[0].threshold).toBe(2)
    expect(wallet.paths[0].keys).toHaveLength(3)
  })

  it('lists findings and failure worlds the engine produced', async () => {
    const findings = (await call('outlive_list_findings')) as { rule: string }[]
    expect(findings.map((finding) => finding.rule)).toContain('X001')
    const worlds = (await call('outlive_list_worlds')) as {
      id: string
      wallets: { verdict: string }[]
    }[]
    expect(worlds.length).toBeGreaterThan(3)
    expect(worlds[0].wallets[0].verdict).toMatch(/safe|degraded|lost|exposed/)
  })

  it('changes a threshold as one undo step and says so', async () => {
    const wallet = plan().wallets[0].label
    const before = useStore.getState().past.length
    await call('outlive_set_threshold', { wallet, threshold: 3 })
    expect(plan().wallets[0].paths[0].threshold).toBe(3)
    expect(useStore.getState().past.length).toBe(before + 1)
    expect(useStore.getState().toast?.message).toMatch(/^Assistant: /)
    await call('outlive_undo')
    expect(plan().wallets[0].paths[0].threshold).toBe(2)
  })

  it('refuses an impossible threshold with a reason rather than throwing', async () => {
    const answer = await call('outlive_set_threshold', {
      wallet: plan().wallets[0].label,
      threshold: 9,
    })
    expect(answer).toEqual({ ok: false, reason: expect.stringMatching(/between 1 and 3/) })
    expect(plan().wallets[0].paths[0].threshold).toBe(2)
  })

  it('runs every string an agent passes through the key-material guard', async () => {
    const seed =
      'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const answer = await call('outlive_place', { key: seed, what: 'device', place: 'Site A' })
    expect(answer).toMatchObject({ ok: false, reason: expect.stringMatching(/refused/) })
  })

  it('moves where a key is kept', async () => {
    const key = plan().keys[0]
    const place = plan().locations[2]
    await call('outlive_place', { key: key.label, what: 'device', place: place.label })
    expect(plan().keys[0].deviceLocationId).toBe(place.id)
  })

  it('takes things away on the map without changing the plan', async () => {
    const before = plan()
    const answer = (await call('outlive_take_away', {
      labels: [before.locations[0].label, before.locations[1].label],
    })) as { spendable: boolean }[]
    expect(answer[0].spendable).toBe(false)
    expect(plan()).toBe(before)
    expect(takeAgentKnockouts()?.map((item) => item.kind)).toEqual(['locations', 'locations'])
    expect(window.location.hash).toBe('#/map')
  })

  it('makes the next move only when asked to', async () => {
    // A single key in one place, which has an obvious next move.
    await call('outlive_build_plan', { threshold: 1, keys: 1 })
    const before = plan()
    const described = await call('outlive_next_move')
    expect(described.applied).toBe(false)
    expect(described.move).toEqual([expect.any(String)])
    expect(plan()).toBe(before)
    await call('outlive_next_move', { apply: true })
    expect(plan()).not.toBe(before)
  })

  it('builds a new plan without touching the open one', async () => {
    const first = plan().id
    await call('outlive_build_plan', { threshold: 1, keys: 1 })
    expect(useStore.getState().plans).toHaveLength(2)
    expect(plan().id).not.toBe(first)
    expect(plan().keys).toHaveLength(1)
  })

  it('does nothing in a browser without WebMCP', () => {
    stop()
    delete (document as unknown as { modelContext?: unknown }).modelContext
    expect(() => registerAgentTools()()).not.toThrow()
  })
})
