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
