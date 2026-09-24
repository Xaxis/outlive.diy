import { describe, expect, it } from 'vitest'
import { PRESETS, presetsFor } from './presets.ts'
import { createPlan } from './factory.ts'
import { exampleById } from './examples.ts'
import { referentialProblems } from './schema.ts'
import { inspectDeep } from '../guard/guard.ts'
import { analyze } from '../analysis/analyze.ts'
import { baseWorld, evaluateWallet } from '../analysis/availability.ts'
import type { Plan } from './types.ts'

/** Every preset, in step order, applied to a plan built only from presets. */
function fromNothing(pick: (step: string) => string): Plan {
  const plan = createPlan()
  for (const step of [
    'profile',
    'locations',
    'people',
    'devices',
    'keys',
    'wallets',
    'checks',
  ] as const) {
    const preset = presetsFor(step).find((entry) => entry.id === pick(step))!
    expect(preset.blocked(plan)).toBeNull()
    preset.apply(plan)
  }
  return plan
}

describe('presets', () => {
  it('build a whole, spendable plan from nothing, one click per step', () => {
    const plan = fromNothing(
      (step) =>
        ({
          profile: 'profile-saver',
          locations: 'places-three-regions',
          people: 'people-successor',
          devices: 'devices-three-makers',
          keys: 'keys-per-device',
          wallets: 'wallets-two-of-three',
          checks: 'checks-standard',
        })[step]!
    )
    expect(referentialProblems(plan)).toEqual([])
    expect(inspectDeep(plan)).toEqual([])
    expect(evaluateWallet(plan, plan.wallets[0], baseWorld(plan)).spendable).toBe(true)
    // Three regions, three makers and a key per place: nothing one place or
    // one maker can take away, and nobody who can spend alone.
    const rules = analyze(plan).findings.map((finding) => finding.rule)
    for (const rule of ['L001', 'C001', 'C003', 'R001', 'R003', 'L008', 'U001'])
      expect(rules).not.toContain(rule)
  })

  it('only ever add, and leave a plan whole whatever it already held', () => {
    for (const preset of PRESETS) {
      const plan = exampleById('two-of-three')!
      const before = {
        locations: plan.locations.length,
        people: plan.people.length,
        devices: plan.devices.length,
        keys: plan.keys.length,
        wallets: plan.wallets.length,
        verifications: plan.verifications.length,
      }
      if (preset.blocked(plan)) continue
      preset.apply(plan)
      expect(referentialProblems(plan)).toEqual([])
      expect(inspectDeep(plan)).toEqual([])
      for (const [field, count] of Object.entries(before))
        expect((plan as unknown as Record<string, unknown[]>)[field].length).toBeGreaterThanOrEqual(
          count
        )
    }
  })

  it('say why they cannot be used yet, rather than doing something half', () => {
    const empty = createPlan()
    expect(PRESETS.find((entry) => entry.id === 'wallets-two-of-three')!.blocked(empty)).toMatch(
      /three keys/
    )
    expect(PRESETS.find((entry) => entry.id === 'keys-per-device')!.blocked(empty)).toMatch(
      /devices first/
    )
  })

  it('never label a person or a place with anything but a role', () => {
    const plan = fromNothing(
      (step) =>
        ({
          profile: 'profile-family',
          locations: 'places-home-bank-relative',
          people: 'people-successor-executor',
          devices: 'devices-three-makers',
          keys: 'keys-per-device',
          wallets: 'wallets-two-of-three',
          checks: 'checks-standard',
        })[step]!
    )
    for (const location of plan.locations) expect(location.label).toMatch(/^Site [A-Z]$/)
    for (const person of plan.people) expect(person.label).toMatch(/^(Successor|Executor) \d+$/)
  })
})
