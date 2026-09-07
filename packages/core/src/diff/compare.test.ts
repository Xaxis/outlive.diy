import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis/analyze.ts'
import { compareReports, comparePlans, summariseDelta } from './compare.ts'
import { exampleById } from '../model/examples.ts'
import { createLocation, createPlan } from '../model/factory.ts'
import type { Plan } from '../model/types.ts'

const TODAY = '2026-03-01'
const run = (plan: Plan) => analyze(plan, { today: TODAY, includeScenarios: false })

describe('comparing two runs', () => {
  const before = exampleById('two-of-three') as Plan
  const after = exampleById('two-of-three-repaired') as Plan

  it('matches findings across a draft derived from a plan', () => {
    const delta = compareReports(run(before), run(after))
    // The repair closes the concentration and the lone descriptor copy.
    expect(delta.rulesResolved).toContain('R003')
    expect(delta.rulesResolved).toContain('L008')
    expect(delta.resolved.length).toBeGreaterThan(0)
  })

  it('reports a plan compared with itself as identical', () => {
    const delta = compareReports(run(before), run(before))
    expect(delta.resolved).toEqual([])
    expect(delta.introduced).toEqual([])
    expect(delta.changed).toEqual([])
    expect(summariseDelta(delta)).toContain('identical')
  })

  it('counts the severity movement in the direction it actually moved', () => {
    const delta = compareReports(run(before), run(after))
    const worse = delta.severityDelta.critical + delta.severityDelta.high
    expect(worse).toBeLessThanOrEqual(0)
  })

  it('says plainly when a change only opens findings', () => {
    const plan = exampleById('two-of-three-repaired') as Plan
    const worse: Plan = {
      ...plan,
      people: plan.people.map((person) => ({ ...person, knowsWhereInstructionsAre: false })),
    }
    const delta = compareReports(run(plan), run(worse))
    expect(delta.introduced.map((finding) => finding.rule)).toContain('U004')
    expect(delta.resolved).toEqual([])
    expect(summariseDelta(delta)).toBe('Opens 1 new finding and closes none.')
  })

  it('says plainly when a change trades one thing for another', () => {
    const plan = exampleById('two-of-three') as Plan
    const traded: Plan = {
      ...plan,
      wallets: plan.wallets.map((wallet) =>
        wallet.id === 'wal_vault' ? { ...wallet, configBackups: [] } : wallet
      ),
    }
    const delta = compareReports(run(plan), run(traded))
    // Losing the only descriptor copy closes the "only one copy" finding by
    // replacing it with the worse one: there is now no copy at all.
    expect(delta.introduced.map((finding) => finding.rule)).toContain('S010')
    expect(delta.rulesResolved).toContain('L008')
    expect(summariseDelta(delta)).toMatch(/^Closes \d+, opens \d+/)
  })
})

describe('comparing two plans', () => {
  it('names what changed, by entity and by field', () => {
    const before = exampleById('two-of-three') as Plan
    const after = exampleById('two-of-three-repaired') as Plan
    const changes = comparePlans(before, after)

    const bank = changes.find((change) => change.id === 'loc_bank')
    expect(bank?.kind).toBe('changed')
    expect(bank?.fields).toContain('disasterGroup')
    expect(bank?.fields).toContain('travelMinutes')
  })

  it('reports additions and removals', () => {
    const base = createPlan({ id: 'p', locations: [createLocation({ id: 'a', label: 'Site A' })] })
    const added: Plan = {
      ...base,
      locations: [...base.locations, createLocation({ id: 'b', label: 'Site B' })],
    }
    expect(comparePlans(base, added)).toEqual([
      { kind: 'added', entity: 'location', id: 'b', label: 'Site B', fields: [] },
    ])
    expect(comparePlans(added, base)).toEqual([
      { kind: 'removed', entity: 'location', id: 'b', label: 'Site B', fields: [] },
    ])
  })

  it('says nothing about a plan compared with itself', () => {
    const plan = exampleById('two-of-three') as Plan
    expect(comparePlans(plan, plan)).toEqual([])
  })

  it('treats a list change as one field rather than enumerating positions', () => {
    const base = exampleById('two-of-three') as Plan
    const trimmed: Plan = {
      ...base,
      wallets: base.wallets.map((wallet) =>
        wallet.id === 'wal_vault'
          ? { ...wallet, paths: [{ ...wallet.paths[0], keyIds: ['key_a', 'key_b'] }] }
          : wallet
      ),
    }
    const change = comparePlans(base, trimmed).find((entry) => entry.id === 'wal_vault')
    expect(change?.fields).toEqual(['paths'])
  })
})
