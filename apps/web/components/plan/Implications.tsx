'use client'

import { useMemo } from 'react'
import { Check, CircleAlert, Minus } from 'lucide-react'
import { profileImplications, type Plan } from '@outlive/core'
import { Info, Panel } from '@/components/ui/Surface.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * What the answers add up to, measured against the plan as it stands.
 *
 * This is the half that was missing. The questions above set targets; without
 * this the reader has no way of knowing whether anything they described meets
 * them, and the answers become decoration. Every line here is computed from the
 * plan, and where there is nothing to measure yet it says so rather than
 * reporting agreement it has not earned.
 *
 * There is no score and no total. A count of ticks would be read as a target
 * and optimised, which is the failure this whole program is built to avoid.
 */
/** One or two words for each question, so an answer reads without it. */
const TOPIC: Record<string, string> = {
  concerns: 'Threats',
  tolerance: 'Downtime',
  horizon: 'Lifespan',
  jurisdiction: 'Legal systems',
  travel: 'Away often',
}

export function Implications({ plan, className }: { plan: Plan; className?: string }) {
  const implications = useMemo(() => profileImplications(plan), [plan])

  return (
    <Panel className={cn('p-4', className)}>
      <p className="eyebrow mb-3">What you said, against what you built</p>
      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {implications.map((implication) => {
          const Icon = implication.meets === null ? Minus : implication.meets ? Check : CircleAlert
          return (
            <li key={implication.id} className="flex gap-2.5">
              <Icon
                className={cn(
                  'mt-[0.15rem] size-3.5 flex-none',
                  implication.meets === null
                    ? 'text-faint'
                    : implication.meets
                      ? 'text-ok'
                      : 'text-high'
                )}
                aria-hidden
              />
              <div className="min-w-0">
                {/* The answer, then the measurement only where it fails. A
                    measurement that agrees is behind the info mark; one that
                    does not is the reason this panel exists. */}
                <p className="text-[0.8125rem] leading-snug text-body">
                  <span className="sr-only">{implication.question} </span>
                  <span className="font-medium text-strong">
                    {TOPIC[implication.id] ?? implication.question}
                  </span>{' '}
                  {implication.said}
                  <span className="sr-only">
                    {implication.meets === null
                      ? ' Nothing measured against this yet.'
                      : implication.meets
                        ? ' The plan meets this.'
                        : ' The plan does not meet this.'}
                  </span>
                  {implication.meets === false ? null : (
                    <Info label={implication.question}>{implication.measured}</Info>
                  )}
                </p>
                {implication.meets === false ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-high">{implication.measured}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
