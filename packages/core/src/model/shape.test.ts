import { describe, expect, it } from 'vitest'
import { defaultShape, planFromShape, spreadPlacement, type Shape } from './shape.ts'
import { parsePlanFile, referentialProblems } from './schema.ts'
import { inspectDeep } from '../guard/guard.ts'
import { analyze } from '../analysis/analyze.ts'
import { baseWorld, evaluateWallet } from '../analysis/availability.ts'

const shapes: Record<string, Shape> = {
  default: defaultShape(),
  single: { ...defaultShape(), threshold: 1, keys: 1, placement: spreadPlacement(1, 3, false) },
  threeOfFive: {
    ...defaultShape(),
    threshold: 3,
    keys: 5,
    placement: spreadPlacement(5, 3, false),
  },
  collaborative: {
    ...defaultShape(),
    collaborative: true,
    placement: spreadPlacement(3, 3, true),
  },
  hot: { ...defaultShape(), hotWallet: true },
  oneRoom: {
    ...defaultShape(),
    places: [defaultShape().places[0]],
    placement: spreadPlacement(3, 1, false),
    configPlaces: [0],
    successorPlaces: [0],
  },
}

describe('a plan from its shape', () => {
  for (const [name, shape] of Object.entries(shapes)) {
    it(`${name}: is a whole plan the file format accepts and the guard passes`, () => {
      const plan = planFromShape(shape)
      expect(referentialProblems(plan)).toEqual([])
      const parsed = parsePlanFile({
        schemaVersion: 1,
        generator: 'test',
        savedAt: '2026-01-01',
        plans: [plan],
        activePlanId: plan.id,
      })
      expect(parsed.ok).toBe(true)
      expect(inspectDeep(plan)).toEqual([])
      // Spendable today, with nothing wrong: a generated plan that could not
      // be spent even at rest would be a template bug, not a finding.
      for (const wallet of plan.wallets) {
        expect(evaluateWallet(plan, wallet, baseWorld(plan)).spendable).toBe(true)
      }
      expect(analyze(plan).brokenReferences).toEqual([])
    })
  }

  it('never leaves a quorum in one place when there are places enough', () => {
    for (let keys = 2; keys <= 7; keys++) {
      const placement = spreadPlacement(keys, keys, false)
      // One key's material per place.
      for (let place = 0; place < keys; place++) {
        const here = placement.filter((entry) => entry.device === place || entry.backup === place)
        expect(here).toHaveLength(1)
      }
    }
    // A single key keeps its device and backup apart.
    const [single] = spreadPlacement(1, 2, false)
    expect(single.device).not.toBe(single.backup)
  })

  it('starts from a plan nothing can take away, and nobody can take alone', () => {
    // The one critical left is coercion: two keys within a day's drive is
    // true of any plan without a timelock, and saying otherwise would be the
    // builder hiding a finding to look good.
    const critical = analyze(planFromShape(defaultShape())).findings.filter(
      (finding) => finding.severity === 'critical'
    )
    expect(critical.map((finding) => finding.rule)).toEqual(['X001'])
  })

  it('gives a held key nothing of its own to lose', () => {
    const plan = planFromShape(shapes.collaborative)
    const held = plan.keys.find((key) => key.heldBy !== null)!
    expect(held.deviceId).toBeNull()
    expect(held.backups).toEqual([])
    expect(plan.people.find((person) => person.id === held.heldBy)?.role).toBe('professional')
  })

  it('schedules every check it can and marks none of them done', () => {
    const plan = planFromShape(defaultShape())
    expect(plan.verifications.length).toBeGreaterThan(0)
    expect(plan.verifications.every((check) => check.lastVerifiedAt === null)).toBe(true)
    expect(plan.verifications.map((check) => check.kind)).toContain('config-backup-restore')
  })
})
