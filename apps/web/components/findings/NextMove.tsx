'use client'

import { netChange } from '@/lib/net.ts'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, LoaderCircle } from 'lucide-react'
import {
  describeActions,
  improve,
  newId,
  tradeoffs,
  type Improvement,
  type Plan,
  type RankedFix,
} from '@outlive/core'
import { navigateTo } from '@/lib/router.ts'
import { Disclosure } from '@/components/ui/Disclosure.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { baseName, useStore } from '@/lib/store.ts'

/**
 * The one thing to do next, found rather than suggested.
 *
 * The overview listed what was wrong and left choosing what to do about it
 * to the reader. The engine can answer that: of every change it knows how to
 * make, which one closes the most without opening anything critical. That is
 * the next move, stated as the change itself, with what it closes and one
 * button that makes it. When nothing structural helps, it says so and the
 * list below is the work.
 */

const cache = new WeakMap<Plan, Improvement>()

/** The next move for a plan, searched for once and then remembered. */
export function nextMoveFor(plan: Plan): Improvement {
  const known = cache.get(plan)
  if (known) return known
  const found = improve(plan, { maxSteps: 1 })
  cache.set(plan, found)
  return found
}

export function NextMove({ plan }: { plan: Plan }) {
  const applyPlan = useStore((state) => state.applyPlan)
  const notify = useStore((state) => state.notify)
  const [move, setMove] = useState<Improvement | null>(() => cache.get(plan) ?? null)
  const [searched, setSearched] = useState<Plan | null>(() => (cache.has(plan) ? plan : null))

  useEffect(() => {
    if (cache.has(plan)) return
    // After a paint, so the overview is on screen while the search runs.
    const timer = window.setTimeout(() => {
      const found = nextMoveFor(plan)
      setMove(found)
      setSearched(plan)
    }, 60)
    return () => window.clearTimeout(timer)
  }, [plan])

  const current = searched === plan ? move : (cache.get(plan) ?? null)

  if (!current) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden />
        Trying every change it knows against this plan…
      </p>
    )
  }

  if (current.steps.length === 0) return <Tradeoffs plan={plan} />

  const closes = current.steps.flatMap((step) => step.closes)
  const errands = describeActions(plan, current.plan).filter((action) => action.errand)
  const opens = current.steps.flatMap((step) => step.opens)

  return (
    <div>
      <ol className="space-y-1.5">
        {current.steps.map((step, index) => (
          <li key={step.fix.id} className="flex items-start gap-2 text-[0.9375rem] text-strong">
            <ArrowRight className="mt-1 size-4 flex-none text-accent" aria-hidden />
            <span>
              {index > 0 ? 'then ' : ''}
              {step.fix.label}
            </span>
          </li>
        ))}
      </ol>
      <ul className="mt-2.5 space-y-1">
        {closes.slice(0, 4).map((finding) => (
          <li key={finding.id} className="flex items-start gap-2 text-xs text-muted">
            <SeverityDot severity={finding.severity} className="mt-[0.35rem]" />
            <span>
              <span className="text-ok">closes</span> {finding.title}
            </span>
          </li>
        ))}
        {closes.length > 4 ? (
          <li className="pl-4 text-xs text-faint">and {closes.length - 4} more</li>
        ) : null}
        {eased(current.steps.flatMap((step) => step.shifts)).map((pair) => (
          <li key={pair.before.id} className="flex items-start gap-2 text-xs text-muted">
            <SeverityDot severity={pair.after.severity} className="mt-[0.35rem]" />
            <span>
              <span className="text-ok">eases</span> {pair.before.title}, {pair.before.severity} to{' '}
              {pair.after.severity}
            </span>
          </li>
        ))}
        {opens.map((finding) => (
          <li key={finding.id} className="flex items-start gap-2 text-xs text-muted">
            <SeverityDot severity={finding.severity} className="mt-[0.35rem]" />
            <span>
              <span className="text-medium">opens</span> {finding.title}
            </span>
          </li>
        ))}
      </ul>
      {errands.length > 1 ? (
        // One sentence can be six trips. The errands are what the reader will
        // actually do, and they are the same words the comparison uses.
        <Disclosure
          size="aside"
          title={`What that means doing (${errands.length})`}
          className="mt-2.5"
        >
          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-body">
            {errands.map((errand, index) => (
              <li key={index}>{errand.text}</li>
            ))}
          </ol>
        </Disclosure>
      ) : null}
      <div className="mt-3">
        <Button
          variant="primary"
          icon={<Check className="size-4" aria-hidden />}
          onClick={() => {
            applyPlan(current.plan)
            notify({
              tone: 'ok',
              message: 'Applied',
              detail: netChange(closes.length, opens.length),
              undoable: true,
            })
          }}
        >
          Apply this change
        </Button>
      </div>
    </div>
  )
}

/**
 * Where no change wins outright, the trades that do most against the worst
 * findings, each with its cost beside it. Tried against the whole analysis
 * like any fix, and never applied here: a trade opens as a draft to compare.
 */
function Tradeoffs({ plan }: { plan: Plan }) {
  const addPlan = useStore((state) => state.addPlan)
  const setCompare = useStore((state) => state.setCompare)
  const [offered, setOffered] = useState<{ plan: Plan; list: RankedFix[] } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setOffered({ plan, list: tradeoffs(plan) }), 60)
    return () => window.clearTimeout(timer)
  }, [plan])

  const intro = <p className="text-sm text-muted">No single change closes more than it opens.</p>
  if (!offered || offered.plan !== plan)
    return (
      <div className="space-y-2">
        {intro}
        <p className="flex items-center gap-2 text-xs text-faint">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Looking for trades worth making…
        </p>
      </div>
    )
  if (offered.list.length === 0)
    return (
      <div>
        <p className="text-sm text-muted">
          No change this program can make closes more than it opens. What is left needs a decision
          only you can make, or a check only you can do.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={() => navigateTo('checkin')}>
            Do the checks
          </Button>
          <Button size="sm" onClick={() => navigateTo('findings')}>
            Read what is left
          </Button>
        </div>
      </div>
    )

  return (
    <div>
      {intro}
      <p className="mt-1 text-sm text-body">
        These each close something serious and cost something else. Which is worth it is yours to
        weigh:
      </p>
      <ul className="mt-3 space-y-2.5">
        {offered.list.map((result) => (
          <li
            key={result.fix.id}
            className="rounded-[var(--radius-control)] border border-line p-3"
          >
            <p className="text-[0.875rem] leading-snug text-strong">{result.fix.label}</p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
              {result.closes.slice(0, 2).map((finding) => (
                <li key={finding.id} className="flex items-start gap-1.5">
                  <SeverityDot severity={finding.severity} className="mt-[0.3rem]" />
                  <span>
                    <span className="text-ok">closes</span> {finding.title}
                  </span>
                </li>
              ))}
              {eased(result.shifts)
                .slice(0, 2)
                .map((pair) => (
                  <li key={pair.before.id} className="flex items-start gap-1.5">
                    <SeverityDot severity={pair.after.severity} className="mt-[0.3rem]" />
                    <span>
                      <span className="text-ok">eases</span> {pair.before.title},{' '}
                      {pair.before.severity} to {pair.after.severity}
                    </span>
                  </li>
                ))}
              {result.opens.slice(0, 2).map((finding) => (
                <li key={finding.id} className="flex items-start gap-1.5">
                  <SeverityDot severity={finding.severity} className="mt-[0.3rem]" />
                  <span>
                    <span className="text-medium">opens</span> {finding.title}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                addPlan({
                  ...result.plan,
                  id: newId('plan'),
                  kind: 'draft',
                  name: `${baseName(plan.name)}, trade`,
                })
                setCompare(plan.id)
                navigateTo('compare')
              }}
            >
              Try it as a draft
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as const

/** Findings a change leaves standing but less severe: worth naming, since they are why it helps. */
function eased(shifts: RankedFix['shifts']): RankedFix['shifts'] {
  return shifts.filter((pair) => RANK[pair.after.severity] < RANK[pair.before.severity])
}
