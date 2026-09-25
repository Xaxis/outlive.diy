import { describe, expect, it } from 'vitest'
import { EXAMPLES, exampleById } from '../model/examples.ts'
import { candidateFixes, improve } from '../fixes/fixes.ts'
import { inspectDeep } from '../guard/guard.ts'
import { describeActions, pendingChanges } from './actions.ts'
import { parsePlanFile } from '../model/schema.ts'

const TODAY = '2026-09-25'

describe('a change to a plan, as errands', () => {
  it('says nothing when nothing changed', () => {
    const plan = exampleById('one-signer')!
    expect(describeActions(plan, structuredClone(plan))).toEqual([])
  })

  it('describes every structural fix the engine offers as at least one errand', () => {
    for (const example of EXAMPLES) {
      const base = example.build()
      for (const fix of candidateFixes(base, TODAY).filter((entry) => entry.kind === 'structure')) {
        const after = structuredClone(base)
        fix.apply(after)
        const actions = describeActions(base, after)
        expect(
          actions.filter((action) => action.errand).length,
          `${example.id}: ${fix.label}`
        ).toBeGreaterThan(0)
      }
    }
  })

  it('writes nothing the guard would refuse, and no field names', () => {
    for (const example of EXAMPLES) {
      const base = example.build()
      const result = improve(base, { today: TODAY })
      const actions = describeActions(base, result.plan)
      expect(inspectDeep(actions).filter((hit) => hit.strength === 'refuse')).toEqual([])
      for (const action of actions) expect(action.text).not.toMatch(/[a-z][A-Z]|Id\b|configBackups/)
    }
    // The full improvement search on every example, which is slow on a busy machine.
  }, 30000)

  it('turns a one-signer upgrade into things to go and do', () => {
    const plan = exampleById('one-signer')!
    const upgrade = candidateFixes(plan, TODAY).find((fix) => fix.id.startsWith('upgrade:'))!
    const after = structuredClone(plan)
    upgrade.apply(after)
    const text = describeActions(plan, after).map((action) => action.text)
    expect(text.some((line) => /^Create Key B on Signer B$/.test(line))).toBe(true)
    expect(text.some((line) => /^Write Key B on steel and keep it at /.test(line))).toBe(true)
    expect(
      text.some((line) => /^Set up .* again as 2 of 3 .* and move the coins to it$/.test(line))
    ).toBe(true)
    expect(text.some((line) => /^Put a copy of .*'s descriptor at /.test(line))).toBe(true)
  })
})

describe('what is left to do after a change', () => {
  it('lists the errands of a change as open items, without the records', () => {
    const plan = exampleById('one-signer')!
    const upgrade = candidateFixes(plan, TODAY).find((fix) => fix.id.startsWith('upgrade:'))!
    const after = structuredClone(plan)
    upgrade.apply(after)
    const pending = pendingChanges(plan, after, TODAY)
    expect(pending.length).toBe(
      describeActions(plan, after).filter((action) => action.errand).length
    )
    expect(pending.every((entry) => entry.doneAt === null && entry.addedAt === TODAY)).toBe(true)
    expect(new Set(pending.map((entry) => entry.id)).size).toBe(pending.length)
  })

  it('opens a plan file written before the list existed', () => {
    const plan = exampleById('one-signer')! as unknown as Record<string, unknown>
    delete plan.changes
    const parsed = parsePlanFile({
      schemaVersion: 1,
      generator: 'test',
      savedAt: TODAY,
      plans: [plan],
      activePlanId: null,
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.plans[0].changes).toEqual([])
  })
})
