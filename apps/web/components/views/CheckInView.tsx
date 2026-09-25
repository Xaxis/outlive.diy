'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Check, Clock, X } from 'lucide-react'
import {
  checksDue,
  createContext,
  createVerification,
  indexPlan,
  today,
  type Plan,
} from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { MEASURE, Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { navigateTo } from '@/lib/router.ts'
import { VERIFICATION_HOW, VERIFICATION_KIND } from '@/lib/describe.ts'

/**
 * Doing the checks, one at a time.
 *
 * Somebody back after six months came for one thing, the checks, and found
 * them two screens down an overview, as rows beside a button. This is the
 * errand list as a sitting: one check on the screen, how to do it in a
 * sentence, and three answers. Done records it today. Couldn't records
 * nothing, because a check that failed has not been passed, and it is listed
 * at the end with where to go about it. Later moves on.
 *
 * The end states what was recorded and what was not, and nothing else. A
 * program whose job is to be unflattering does not say well done.
 */

type Answer = 'done' | 'couldnt' | 'later'

export function CheckInView() {
  const plan = useActivePlan()
  const edit = useStore((state) => state.edit)
  // The list is fixed when the sitting starts, so recording one does not
  // reshuffle the rest under the reader.
  const [due] = useState(() => (plan ? checksDue(createContext(plan)) : []))
  // Changes the plan is waiting for come first: a check of a setup that has
  // not been changed yet tests the old one.
  const [changes] = useState(() =>
    plan ? plan.changes.filter((entry) => entry.doneAt === null) : []
  )
  const [answers, setAnswers] = useState<Answer[]>([])
  const index = useMemo(() => (plan ? indexPlan(plan) : null), [plan])

  // The shell shows the start screen when there is no plan.
  if (!plan || !index) return null

  const label = (subject: { type: string; id: string }) => {
    const found =
      subject.type === 'key'
        ? index.keys.get(subject.id)
        : subject.type === 'wallet'
          ? index.wallets.get(subject.id)
          : subject.type === 'device'
            ? index.devices.get(subject.id)
            : subject.type === 'person'
              ? index.people.get(subject.id)
              : subject.type === 'location'
                ? index.locations.get(subject.id)
                : null
    return found?.label ?? null
  }

  interface Item {
    id: string
    eyebrow: string
    title: string
    subject: string | null
    how: string
    record: (draft: Plan) => void
  }
  const items: Item[] = [
    ...changes.map((change) => ({
      id: change.id,
      eyebrow: `a change to make, added ${change.addedAt}`,
      title: change.text,
      subject: null,
      how: 'The plan already says this is done. Mark it done once it is done in the world as well.',
      record: (draft: Plan) => {
        const target = draft.changes.find((entry) => entry.id === change.id)
        if (target) target.doneAt = today()
      },
    })),
    ...due.map((entry) => ({
      id: entry.verification.id,
      eyebrow: entry.lastVerifiedAt === null ? 'never done' : `${entry.overdueDays} days overdue`,
      title: VERIFICATION_KIND[entry.verification.kind],
      subject: label(entry.verification.subject),
      how: VERIFICATION_HOW[entry.verification.kind],
      record: (draft: Plan) => {
        const target = draft.verifications.find((check) => check.id === entry.verification.id)
        if (target) target.lastVerifiedAt = today()
        else
          draft.verifications.push(
            createVerification({
              kind: entry.verification.kind,
              subject: entry.verification.subject,
              lastVerifiedAt: today(),
            })
          )
      },
    })),
  ]

  const at = answers.length
  const current = items[at]

  const answer = (value: Answer) => {
    if (!current) return
    if (value === 'done') edit(current.record)
    setAnswers((list) => [...list, value])
  }

  const header = (
    <ViewHeader
      eyebrow="Check-in"
      title="Do the checks"
      question="One at a time. Done records it today; anything you could not do stays open."
    />
  )

  if (items.length === 0)
    return (
      <div className={MEASURE.read}>
        {header}
        <Panel className="p-5">
          <p className="text-sm text-body">
            Nothing is due and no change is waiting. That means every check this program knows about
            has a recent date, not that the plan works: it only knows what you have told it.
          </p>
          <Button className="mt-4" onClick={() => navigateTo('overview')}>
            Back to the overview
          </Button>
        </Panel>
      </div>
    )

  if (!current) {
    const done = items.filter((_, position) => answers[position] === 'done')
    const couldnt = items.filter((_, position) => answers[position] === 'couldnt')
    const later = items.filter((_, position) => answers[position] === 'later')
    const line = (entry: Item) => `${entry.title}${entry.subject ? ` · ${entry.subject}` : ''}`
    return (
      <div className={MEASURE.read}>
        {header}
        <Panel className="space-y-4 p-5">
          <p className="text-sm text-body">
            {done.length} recorded as done today, {couldnt.length} could not be done, {later.length}{' '}
            left for later.
          </p>
          {couldnt.length > 0 ? (
            <div>
              <p className="label mb-1.5">Could not be done</p>
              <ul className="space-y-1 text-sm text-body">
                {couldnt.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2">
                    <X className="mt-0.5 size-4 flex-none text-critical" aria-hidden />
                    {line(entry)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                A check that could not be done is the most useful thing a check can tell you. The
                findings say what depends on it.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => navigateTo('overview')}>
              Back to the overview
            </Button>
            {couldnt.length > 0 ? (
              <Button onClick={() => navigateTo('findings')}>Read the findings</Button>
            ) : null}
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className={MEASURE.read}>
      {header}
      <div className="mb-3 flex gap-1" aria-hidden>
        {items.map((entry, position) => (
          <span
            key={entry.id}
            className={
              position < at
                ? answers[position] === 'done'
                  ? 'h-1.5 flex-1 rounded-full bg-ok'
                  : answers[position] === 'couldnt'
                    ? 'h-1.5 flex-1 rounded-full bg-critical'
                    : 'h-1.5 flex-1 rounded-full bg-line-strong'
                : position === at
                  ? 'h-1.5 flex-1 rounded-full bg-accent'
                  : 'h-1.5 flex-1 rounded-full bg-line'
            }
          />
        ))}
      </div>
      <Panel className="p-5">
        <p className="eyebrow">
          {at + 1} of {items.length} · {current.eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-strong">
          {current.title}
          {current.subject ? <span className="text-muted"> · {current.subject}</span> : null}
        </h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-body">{current.how}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={<Check className="size-4" aria-hidden />}
            onClick={() => answer('done')}
          >
            Done today
          </Button>
          <Button icon={<X className="size-4" aria-hidden />} onClick={() => answer('couldnt')}>
            Could not do it
          </Button>
          <Button
            variant="ghost"
            icon={<Clock className="size-4" aria-hidden />}
            onClick={() => answer('later')}
          >
            Later
          </Button>
        </div>
      </Panel>
      <button
        type="button"
        onClick={() => navigateTo('overview')}
        className="mt-3 inline-flex items-center gap-1 text-xs text-muted underline underline-offset-2 hover:text-strong"
      >
        Stop here
        <ArrowRight className="size-3" aria-hidden />
      </button>
    </div>
  )
}
