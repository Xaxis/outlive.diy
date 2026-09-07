'use client'

import type { Wallet } from '@outlive/core'
import { cn } from '@/lib/cn.ts'

/**
 * When each way of spending opens.
 *
 * A plain m-of-n needs no picture: the number says it. A policy with a
 * timelocked inheritance path is the one thing in this model that is genuinely
 * hard to hold in your head, because it is a statement about the future rather
 * than about objects, and the numbers are in two different units. So this
 * appears only when there is more than one way to spend, or when one of them
 * has to wait.
 */
export function PolicyTimeline({ wallet }: { wallet: Wallet }) {
  const paths = [...wallet.paths].sort((a, b) => a.timelockDays - b.timelockDays)
  const worthDrawing = paths.length > 1 || paths.some((path) => path.timelockDays > 0)
  if (!worthDrawing || paths.length === 0) return null

  const furthest = Math.max(...paths.map((path) => path.timelockDays))
  // A little headroom, so a bar that opens at the end is still visible.
  const span = furthest === 0 ? 1 : furthest * 1.15

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-sunken p-3">
      <p className="eyebrow mb-2.5">When each way opens</p>

      <ul className="space-y-2.5">
        {paths.map((path) => {
          const start = (path.timelockDays / span) * 100
          const open = path.timelockDays === 0
          return (
            <li key={path.id} className="grid grid-cols-[11rem_1fr] items-center gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[0.8125rem] text-body">{path.label}</span>
                {/* The delay belongs beside the numbers, not floating over the
                    bar it describes: at 180 days out of 180 the bar is a stub
                    at the right edge and the label lands on top of it. */}
                <span className="mono block truncate text-[0.6875rem] text-faint">
                  {path.threshold} of {path.keyIds.length}
                  {open ? '' : ` · after ${path.timelockDays}d`}
                </span>
              </span>
              <span className="relative h-4">
                <span className="absolute inset-y-1/2 left-0 right-0 h-px -translate-y-1/2 bg-line" />
                <span
                  className={cn(
                    'absolute inset-y-1/2 right-0 h-1.5 -translate-y-1/2 rounded-full',
                    open ? 'bg-accent/70' : 'bg-medium/80'
                  )}
                  style={{ left: `${start}%` }}
                />
                {open ? null : (
                  <span
                    className="absolute inset-y-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-medium bg-sunken"
                    style={{ left: `${start}%` }}
                  />
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mono mt-2 grid grid-cols-[11rem_1fr] gap-3 text-[0.625rem] text-faint">
        <span />
        <span className="flex justify-between">
          <span>today</span>
          <span>{furthest === 0 ? 'always' : `${furthest} days of no movement`}</span>
        </span>
      </div>
    </div>
  )
}
