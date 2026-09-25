'use client'

import { netChange } from '@/lib/net.ts'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { improve, type Improvement, type Plan } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { useStore } from '@/lib/store.ts'

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

export function NextMove({ plan }: { plan: Plan }) {
  const applyPlan = useStore((state) => state.applyPlan)
  const notify = useStore((state) => state.notify)
  const [move, setMove] = useState<Improvement | null>(() => cache.get(plan) ?? null)
  const [searched, setSearched] = useState<Plan | null>(() => (cache.has(plan) ? plan : null))

  useEffect(() => {
    if (cache.has(plan)) return
    // After a paint, so the overview is on screen while the search runs.
    const timer = window.setTimeout(() => {
      const found = improve(plan, { maxSteps: 1 })
      cache.set(plan, found)
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

  if (current.steps.length === 0) {
    return (
      <p className="text-sm text-muted">
        No single change this program can make closes more than it opens. What is left needs a
        decision only you can make, or a check only you can do; the list below is the work.
      </p>
    )
  }

  const closes = current.steps.flatMap((step) => step.closes)
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
        {opens.map((finding) => (
          <li key={finding.id} className="flex items-start gap-2 text-xs text-muted">
            <SeverityDot severity={finding.severity} className="mt-[0.35rem]" />
            <span>
              <span className="text-medium">opens</span> {finding.title}
            </span>
          </li>
        ))}
      </ul>
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
