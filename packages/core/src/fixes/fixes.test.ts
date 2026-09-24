import { describe, expect, it } from 'vitest'
import { analyze } from '../analysis/analyze.ts'
import { exampleById } from '../model/examples.ts'
import { referentialProblems } from '../model/schema.ts'
import { inspectDeep } from '../guard/guard.ts'
import { candidateFixes, fixesFor, improve } from './fixes.ts'

const TODAY = '2026-03-01'

describe('fixes, found by trying them', () => {
  it(
    'closes the finding it is offered for, according to the analysis itself',
    { timeout: 30_000 },
    () => {
      const plan = exampleById('two-of-three')!
      const report = analyze(plan, { today: TODAY })
      let offered = 0
      for (const finding of report.findings) {
        for (const result of fixesFor(plan, finding.id, { today: TODAY })) {
          offered += 1
          const after = analyze(result.plan, { today: TODAY }).findings.map((entry) => entry.id)
          expect(after).not.toContain(finding.id)
          // Nothing as severe as what it closes.
          expect(result.gain).toBeGreaterThan(0)
        }
      }
      // Most of this example's findings have a fix of one or two changes.
      expect(offered).toBeGreaterThan(10)
    }
  )

  it('turns a single key into two of three with one key per region', () => {
    const plan = exampleById('one-signer')!
    const before = analyze(plan, { today: TODAY }).counts.critical
    const [best] = fixesFor(plan, 'L001:loc_home', { today: TODAY })
    expect(best.fix.label).toMatch(/two of three/)
    expect(best.opens).toEqual([])
    expect(analyze(best.plan, { today: TODAY }).counts.critical).toBeLessThan(before)
  })

  it('offers two changes as one fix when no single change is enough', () => {
    const plan = exampleById('two-of-three')!
    const [best] = fixesFor(plan, 'L001:loc_home', { today: TODAY })
    expect(best.fix.label).toMatch(/, and /)
    expect(best.closes.map((finding) => finding.id)).toContain('L001:loc_home')
  })

  it('never edits the plan it was given', () => {
    const plan = exampleById('two-of-three')!
    const before = JSON.stringify(plan)
    fixesFor(plan, 'L008:wal_vault', { today: TODAY })
    improve(plan, { today: TODAY })
    expect(JSON.stringify(plan)).toBe(before)
  })

  it('produces plans that are whole and that the guard accepts', () => {
    const plan = exampleById('two-of-three')!
    for (const fix of candidateFixes(plan, TODAY)) {
      const draft = structuredClone(plan)
      fix.apply(draft)
      expect(referentialProblems(draft)).toEqual([])
      expect(inspectDeep(draft)).toEqual([])
      expect(inspectDeep({ label: fix.label })).toEqual([])
    }
  })

  it('improves step by step, never into a new critical, and only structurally', () => {
    const plan = exampleById('two-of-three')!
    const before = analyze(plan, { today: TODAY }).counts
    const result = improve(plan, { today: TODAY })
    const after = analyze(result.plan, { today: TODAY }).counts
    expect(result.steps.length).toBeGreaterThan(0)
    expect(after.critical).toBeLessThan(before.critical)
    expect(result.steps.every((step) => step.fix.kind === 'structure')).toBe(true)
    expect(result.steps.every((step) => !step.opens.some((f) => f.severity === 'critical'))).toBe(
      true
    )
  })

  it('offers a record only as what it is: something the reader says they did', () => {
    const plan = exampleById('two-of-three')!
    const records = candidateFixes(plan, TODAY).filter((fix) => fix.kind === 'record')
    expect(records.length).toBeGreaterThan(0)
    expect(records.every((fix) => /^(I |.+ rehearsed)/.test(fix.label))).toBe(true)
  })
})
