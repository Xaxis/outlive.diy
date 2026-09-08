'use client'

import { useMemo } from 'react'
import { Check, CircleAlert, Minus } from 'lucide-react'
import { profileImplications, type Plan } from '@outlive/core'
import { Panel } from '@/components/ui/Surface.tsx'
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
export function Implications({ plan, className }: { plan: Plan; className?: string }) {
  const implications = useMemo(() => profileImplications(plan), [plan])

  return (
    <Panel className={cn('p-4', className)}>
      <p className="eyebrow mb-1">What you said, against what you built</p>
      <p className="mb-4 text-xs leading-relaxed text-faint">
        Each answer above governs a real part of the analysis. This is what the plan underneath it
        currently does about it.
      </p>
      <ul className="grid gap-3.5">
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
                <p className="text-[0.8125rem] leading-snug text-strong">
                  {implication.question}
                  {/* The answer is repeated here rather than only sitting in the
                      control, because the panel has to read on its own when it
                      is beside a step that is not the purpose step. */}
                  <span className="block font-medium text-body">
                    You said: {implication.said}.
                    <span className="sr-only">
                      {implication.meets === null
                        ? ' Nothing measured against this yet.'
                        : implication.meets
                          ? ' The plan meets this.'
                          : ' The plan does not meet this.'}
                    </span>
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{implication.measured}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
