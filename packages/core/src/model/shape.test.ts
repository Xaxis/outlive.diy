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
    successorPlace: 0,
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

  it('never puts a key and its only backup in one place when there is another', () => {
    for (let keys = 1; keys <= 7; keys++) {
      for (let places = 2; places <= 5; places++) {
        for (const placement of spreadPlacement(keys, places, false)) {
          expect(placement.device).not.toBe(placement.backup)
        }
      }
    }
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
