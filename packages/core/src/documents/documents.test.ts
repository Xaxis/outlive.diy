import { describe, expect, it } from 'vitest'
import { buildRunbook } from './runbook.ts'
import { recoveryRoutes } from './recovery.ts'
import { lettersFor, successorLetter } from './successor-letter.ts'
import { createContext } from '../analysis/context.ts'
import { exampleById } from '../model/examples.ts'
import { inspectDeep } from '../guard/guard.ts'
import type { Plan } from '../model/types.ts'

const TODAY = '2026-03-01'
const plan = () => exampleById('two-of-three') as Plan
const repaired = () => exampleById('two-of-three-repaired') as Plan

describe('the build runbook', () => {
  it('runs in phase order', () => {
    const runbook = buildRunbook(plan())
    const phases = runbook.phases.map((group) => group.phase)
    expect(phases[0]).toBe('prepare')
    expect(phases[phases.length - 1]).toBe('schedule')
  })

  it('separates the steps that produce evidence', () => {
    const runbook = buildRunbook(plan())
    expect(runbook.gates.length).toBeGreaterThan(0)
    for (const gate of runbook.gates) expect(gate.gate).toBe(true)
    // A gate for every key's backup, and one for the wallet's descriptor.
    expect(runbook.gates.map((gate) => gate.id)).toContain('verify-key_a')
    expect(runbook.gates.map((gate) => gate.id)).toContain('verify-config-wal_vault')
  })

  it('tells the user to export the descriptor for a multisig wallet', () => {
    const steps = buildRunbook(plan()).steps.map((step) => step.id)
    expect(steps).toContain('config-wal_vault')
  })

  it('does not ask for a descriptor when nothing is multisig', () => {
    const single = exampleById('one-signer') as Plan
    expect(buildRunbook(single).steps.map((step) => step.id)).not.toContain('config-wal_savings')
  })

  it('does not tell a single-key wallet which keys to choose between', () => {
    const one = plan()
    one.wallets = [one.wallets.find((wallet) => wallet.paths[0].threshold === 1)!]
    const spend = buildRunbook(one).steps.find((step) => step.id.startsWith('verify-spend-'))!
    expect(spend.detail).not.toMatch(/nearest/)
    expect(spend.detail).toContain('nothing to choose between')
    // No dangling space from a conditional clause that did not fire. It is a
    // printed document.
    expect(spend.detail).toBe(spend.detail.trim())
  })

  it('gives every configuration copy it asks for somewhere to go', () => {
    const config = buildRunbook(plan()).steps.find((step) => step.id.startsWith('config-'))!
    const asked = Number(config.title.match(/copy it (\d+) times/)![1])
    expect(asked).toBe(2)
    // The example records one place. Asking for two copies and naming one home
    // leaves the second wherever the reader was standing.
    expect(config.detail).toContain('does not say where the other goes')
  })

  it('does not tell somebody with one device to buy them at different times', () => {
    const one = plan()
    one.devices = [one.devices[0]]
    const acquire = buildRunbook(one).steps.find((step) => step.id === 'acquire')!
    expect(acquire.title).toContain('1 signing device')
    expect(acquire.detail).not.toMatch(/Buy them/)
    expect(acquire.detail).toContain('Buy it direct from the maker')
  })

  it('does not tell the reader to unbox a cosigning service', () => {
    const service = plan()
    service.devices[1] = {
      ...service.devices[1],
      label: 'Cosigner service',
      kind: 'service-cosigner',
      vendor: 'A company',
    }
    service.keys[1] = { ...service.keys[1], deviceLocationId: null, backups: [] }
    const steps = buildRunbook(service).steps
    const acquire = steps.find((step) => step.id === 'acquire')!
    // You do not buy it at a quiet time, open its packaging, or check a
    // firmware signature on it.
    expect(acquire.detail).not.toContain('Cosigner service')
    expect(steps.find((step) => step.id === 'service')?.title).toContain('A company')
    // And it is online by definition, so it is not generated offline with
    // nothing else connected.
    const generate = steps.find((step) => step.id === `generate-${service.keys[1].id}`)!
    expect(generate.title).toContain('Have A company generate')
    expect(generate.detail).not.toContain('offline')
  })

  it('ends by telling the user to destroy the working notes', () => {
    const steps = buildRunbook(plan()).steps
    expect(steps[steps.length - 1].id).toBe('record-nothing')
  })
})

describe('recovery routes', () => {
  it('exist for every location, both lost and opened', () => {
    const routes = recoveryRoutes(createContext(plan(), { today: TODAY }))
    expect(routes.some((route) => route.scenarioId === 'location-lost:loc_home')).toBe(true)
    expect(routes.some((route) => route.scenarioId === 'location-compromised:loc_home')).toBe(true)
  })

  it('collect the wallet configuration before travelling', () => {
    const routes = recoveryRoutes(createContext(repaired(), { today: TODAY }))
    const route = routes.find((entry) => entry.scenarioId === 'location-lost:loc_bank')
    expect(route?.possible).toBe(true)
    expect(route?.steps[0].title).toContain('wallet configuration')
  })

  it('visit the furthest place first', () => {
    const routes = recoveryRoutes(createContext(repaired(), { today: TODAY }))
    const route = routes.find((entry) => entry.scenarioId === 'location-lost:loc_home')
    const visits = route?.steps.filter((step) => step.title.startsWith('Collect from')) ?? []
    expect(visits.length).toBeGreaterThan(1)
    expect(visits[0].title).toContain('Site C')
  })

  it('say plainly when there is no route, and why', () => {
    const routes = recoveryRoutes(createContext(plan(), { today: TODAY }))
    const death = routes.find((entry) => entry.scenarioId === 'user-death:all')
    expect(death?.possible).toBe(false)
    expect(death?.blockers.length).toBeGreaterThan(0)
  })

  it('tell the user to move the coins after a compromise, not merely to recover', () => {
    const routes = recoveryRoutes(createContext(repaired(), { today: TODAY }))
    const opened = routes.find((entry) => entry.scenarioId === 'location-compromised:loc_home')
    expect(opened?.steps.some((step) => step.title.startsWith('Move the balance now'))).toBe(true)
  })

  // A route answers "what can you still do". The compromise and coercion
  // scenarios ask "can they spend", and reading the route off that answer
  // inverts the whole document: the places whose burglary the plan survives
  // come out as total losses, and the ones that end it come out recoverable.
  it("answer the reader's question after a burglary, not the intruder's", () => {
    const routes = recoveryRoutes(createContext(repaired(), { today: TODAY }))
    for (const location of repaired().locations) {
      const opened = routes.find(
        (entry) => entry.scenarioId === `location-compromised:${location.id}`
      )!
      const gone = routes.find((entry) => entry.scenarioId === `location-lost:${location.id}`)!
      // Somebody else having a copy is at least as bad as the copy burning, and
      // the plan is the same plan either way.
      expect(opened.possible).toBe(gone.possible)
      expect(opened.walletIds).toEqual(gone.walletIds)
      expect(opened.blockers).toEqual(gone.blockers)
    }
  })

  it('say in the situation what the intruder can spend', () => {
    const ctx = createContext(repaired(), { today: TODAY })
    const routes = recoveryRoutes(ctx)
    const exposing = routes.find(
      (entry) =>
        entry.scenarioId.startsWith('location-compromised:') && entry.exposedWalletIds.length > 0
    )
    const safe = routes.find(
      (entry) =>
        entry.scenarioId.startsWith('location-compromised:') && entry.exposedWalletIds.length === 0
    )
    // Whether anything is moving is the difference between this route and the
    // one for the same place burning down. The list is structured so a
    // renderer can lead with it; that there is no list is prose, because an
    // empty array is silent and silence about a burglary reads as
    // reassurance.
    expect(exposing?.exposedWalletIds.length).toBeGreaterThan(0)
    expect(exposing?.situation).not.toMatch(/Nothing in this plan/)
    expect(safe?.situation).toMatch(/Nothing in this plan can be spent with what they have/)
  })

  it('does not claim a route survives a session that reached everything', () => {
    const all = repaired()
    // Every location within the coercion budget, so the session reaches the
    // whole plan and there is nothing left afterwards.
    all.locations = all.locations.map((location) => ({ ...location, travelMinutes: 5 }))
    const coerced = recoveryRoutes(createContext(all, { today: TODAY })).find((entry) =>
      entry.scenarioId.startsWith('coercion:')
    )!
    expect(coerced.exposedWalletIds.length).toBeGreaterThan(0)
    expect(coerced.possible).toBe(false)
  })
})

describe('the successor letter', () => {
  const ctx = () => createContext(repaired(), { today: TODAY })

  it('is addressed to a role, never a name', () => {
    const letters = lettersFor(ctx())
    expect(letters).toHaveLength(1)
    expect(letters[0].to).toBe('Successor 1')
  })

  it('contains nothing the guard would refuse', () => {
    for (const letter of lettersFor(ctx())) {
      expect(inspectDeep(letter).filter((hit) => hit.strength === 'refuse')).toEqual([])
    }
  })

  it('names no location', () => {
    const context = ctx()
    const text = JSON.stringify(lettersFor(context))
    for (const location of context.plan.locations) {
      expect(text, location.label).not.toContain(location.label)
    }
  })

  it('warns about the two failures that look like theft', () => {
    const person = repaired().people[0]
    const letter = successorLetter(ctx(), person)
    const headings = letter.sections.map((section) => section.heading)
    expect(headings).toContain('Two things that will look like failures and are not')
    expect(headings).toContain('What never to do')
  })

  it('says what it deliberately leaves out', () => {
    const person = repaired().people[0]
    const letter = successorLetter(ctx(), person)
    expect(letter.omissions.length).toBeGreaterThan(2)
  })

  it('warns about the probate delay when the plan has one', () => {
    const person = repaired().people[0]
    const letter = successorLetter(ctx(), person)
    expect(letter.sections.map((section) => section.heading)).toContain(
      'Some of this takes time to open'
    )
  })
})

describe('one letter per successor', () => {
  /** A spouse who can open the door today and an executor who waits for probate. */
  function twoHeirs(): Plan {
    const plan = structuredClone(exampleById('two-of-three')!)
    plan.people = [
      {
        ...plan.people[0],
        id: 'per_spouse',
        label: 'My spouse',
        role: 'successor',
        availability: 'immediate',
        technicalSkill: 'basic',
        knowsPlanExists: true,
        knowsWhereInstructionsAre: true,
      },
      {
        ...plan.people[0],
        id: 'per_child',
        label: 'My child',
        role: 'executor',
        availability: 'days',
        technicalSkill: 'competent',
        knowsPlanExists: true,
        knowsWhereInstructionsAre: true,
      },
    ]
    plan.locations = plan.locations.map((location) => ({
      ...location,
      custodianId: null,
      access: [
        { personId: 'per_spouse', condition: 'always' as const, delayDays: 0 },
        { personId: 'per_child', condition: 'after-death' as const, delayDays: 90 },
      ],
    }))
    return plan
  }

  it('warns about probate only in the letter to the person who waits for it', () => {
    const ctx = createContext(twoHeirs(), { today: '2026-03-01' })
    const letters = lettersFor(ctx)
    expect(letters).toHaveLength(2)

    const headings = (to: string) =>
      letters.find((letter) => letter.to === to)!.sections.map((section) => section.heading)

    // The spouse can open the door today. Telling them to expect a wait they
    // will never have, on a document they read once on the worst day, teaches
    // them to distrust the rest of it.
    expect(headings('My spouse')).not.toContain('Some of this takes time to open')
    expect(headings('My child')).toContain('Some of this takes time to open')
  })

  it('gives the delay that reader faces, not the longest in the plan', () => {
    const plan = twoHeirs()
    // Somebody else waits far longer. It is not this reader's wait.
    plan.locations[0].access.push({
      personId: 'per_spouse',
      condition: 'after-death',
      delayDays: 400,
    })
    plan.locations[1].access = plan.locations[1].access.map((access) =>
      access.personId === 'per_child' ? { ...access, delayDays: 30 } : access
    )
    const ctx = createContext(plan, { today: '2026-03-01' })
    const child = lettersFor(ctx).find((letter) => letter.to === 'My child')!
    const wait = child.sections.find(
      (section) => section.heading === 'Some of this takes time to open'
    )!
    expect(wait.paragraphs[0]).toContain('90 days')
    expect(wait.paragraphs[0]).not.toContain('400')
  })
})
