'use client'

import type { PathAvailability } from '@outlive/core'
import { cn } from '@/lib/cn.ts'

/**
 * A spend path as a row of cells: one per key, filled when that key can be
 * used, with a rule drawn where the threshold falls.
 *
 * The point is the gap between the rule and the last filled cell. That gap is
 * the margin, and it is the single number that decides whether the next thing
 * to go wrong is survivable. It reads at a glance in a way that "2 of 3" never
 * does, because "2 of 3" says what the policy is and not where you are in it.
 *
 * Fill is a shape, not a colour: the state survives being printed in grey and
 * being read by somebody who cannot tell the two colours apart, and the text
 * beside it says the same thing again.
 */
export function QuorumBar({
  path,
  keyLabels,
  className,
}: {
  path: PathAvailability
  keyLabels: { id: string; label: string }[]
  className?: string
}) {
  const margin = path.availableKeyIds.length - path.threshold
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex items-end gap-[3px]" aria-hidden>
        {keyLabels.map((key, index) => {
          const have = path.availableKeyIds.includes(key.id)
          // The rule sits after the last cell that is required.
          const boundary = index === path.threshold - 1
          return (
            <span key={key.id} className="relative flex">
              <span
                title={`${key.label}: ${have ? 'available' : 'not available'}`}
                className={cn(
                  'h-4 w-3 rounded-[2px] border',
                  have ? 'border-transparent bg-ok' : 'border-line-strong bg-transparent'
                )}
              />
              {boundary && keyLabels.length > path.threshold ? (
                <span className="absolute -right-[3px] top-[-3px] h-[22px] w-px bg-strong" />
              ) : null}
            </span>
          )
        })}
      </span>
      <span className="mono text-[0.6875rem] text-muted">
        {path.threshold} needed
        {!path.open
          ? ', locked'
          : margin > 0
            ? `, ${margin} spare`
            : margin === 0
              ? ', no spare'
              : `, ${-margin} short`}
      </span>
    </div>
  )
}
