import { describe, expect, it } from 'vitest'
import { createContext } from './context.ts'
import { analyze } from './analyze.ts'
import { checksDue } from './staleness.ts'
import { EXAMPLES, exampleById } from '../model/examples.ts'
import { createVerification } from '../model/factory.ts'

const TODAY = '2026-09-25'

describe('the checks that are due', () => {
  it('lists a check for everything a staleness rule says was never done', () => {
    let checked = 0
    for (const example of EXAMPLES) {
      const plan = example.build()
      const due = checksDue(createContext(plan, { today: TODAY }))
      const report = analyze(plan, { includeScenarios: false, today: TODAY })
      const covered = new Set(due.map((entry) => entry.verification.subject.id))
      for (const finding of report.findings.filter((entry) => /^T00[2-5]$/.test(entry.rule)))
        for (const subject of finding.subjects.filter((entry) => entry.type !== 'plan')) {
          expect(covered.has(subject.id), `${example.id}: ${finding.title}`).toBe(true)
          checked += 1
        }
    }
    // The examples between them have to exercise the rules for this to mean anything.
    expect(checked).toBeGreaterThan(3)
  })

  it('stops listing a check once it is recorded, and closes what it answered', () => {
    const plan = exampleById('one-signer')!
    const due = checksDue(createContext(plan, { today: TODAY }))
    expect(due.length).toBeGreaterThan(0)
    for (const entry of due) {
      const existing = plan.verifications.find((check) => check.id === entry.verification.id)
      if (existing) existing.lastVerifiedAt = TODAY
      else
        plan.verifications.push(
          createVerification({
            kind: entry.verification.kind,
            subject: entry.verification.subject,
            lastVerifiedAt: TODAY,
          })
        )
    }
    expect(checksDue(createContext(plan, { today: TODAY }))).toEqual([])
    const stale = analyze(plan, { includeScenarios: false, today: TODAY }).findings.filter(
      (finding) => finding.category === 'staleness'
    )
    expect(stale.map((finding) => finding.rule)).toEqual([])
  })
})
