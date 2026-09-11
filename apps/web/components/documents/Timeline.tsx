'use client'

import { Clock, Footprints, Hourglass } from 'lucide-react'
import { describeDuration, type RecoveryTiming } from '@outlive/core'
import { cn } from '@/lib/cn.ts'

/**
 * How long a route takes, drawn to scale.
 *
 * The two kinds of time in a recovery behave completely differently and a
 * single number hides that. Waiting is imposed: probate, a timelock, somebody
 * else's availability, and no amount of effort shortens it. Travelling is work
 * you do. A route that is three weeks of waiting and one afternoon of driving
 * needs a different plan from one that is nine days of driving, and the bar
 * shows which of the two you are looking at before the numbers are read.
 *
 * Widths are proportional and both segments keep a floor, because a segment
 * drawn at one pixel is a segment nobody sees and the caption beside it then
 * looks like a mistake.
 */
export function Timeline({ timing, className }: { timing: RecoveryTiming; className?: string }) {
  if (!timing.possible) return null

  const waiting = timing.steps.filter((step) => step.part === 'wait')
  const waitDays = waiting.reduce((worst, step) => Math.max(worst, step.days), 0)
  const travelDays = Math.max(0, timing.days - waitDays)
  const total = Math.max(1, timing.days)
  const MIN = 8

  return (
    <div className={cn('print-block', className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-strong">
          <Clock className="size-3.5 flex-none text-faint" aria-hidden />
          {describeDuration(timing.days, timing.travelMinutes)}
        </span>
        {timing.unknowns.length > 0 ? (
          <span className="text-[0.6875rem] text-faint">at least, see below</span>
        ) : null}
      </div>

      {timing.days > 0 ? (
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
          {waitDays > 0 ? (
            <span
              className="h-full bg-medium/70"
              style={{ width: `max(${MIN}%, ${(waitDays / total) * 100}%)` }}
            />
          ) : null}
          {travelDays > 0 ? (
            <span
              className="h-full bg-accent/70"
              style={{ width: `max(${MIN}%, ${(travelDays / total) * 100}%)` }}
            />
          ) : null}
        </div>
      ) : null}

      {/* No steps means no travel and no waiting. An empty list still occupies
          a couple of lines on paper, which reads as something that failed to
          render rather than as a route with nothing in the way. */}
      {timing.steps.length === 0 ? null : (
        <ul className="mt-2.5 grid gap-1.5">
          {timing.steps.map((step, position) => (
            <li key={`${step.part}-${position}`} className="flex items-start gap-2">
              {step.part === 'wait' ? (
                <Hourglass className="mt-[0.15rem] size-3 flex-none text-medium" aria-hidden />
              ) : (
                <Footprints className="mt-[0.15rem] size-3 flex-none text-accent" aria-hidden />
              )}
              <span className="min-w-0 text-[0.75rem] leading-snug">
                <span className="text-body">
                  {step.part === 'wait' ? `Wait ${step.days} days: ` : ''}
                  {step.what}
                </span>
                <span className="block text-faint">{step.why}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {timing.unknowns.length > 0 ? (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-faint">
          This is a floor rather than an estimate.{' '}
          {timing.unknowns.map((unknown) => unknown.note).join(' ')}
        </p>
      ) : null}
    </div>
  )
}
