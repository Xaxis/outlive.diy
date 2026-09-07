'use client'

import type { Severity } from '@outlive/core'
import { cn } from '@/lib/cn.ts'

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Note',
}

export function SeverityDot({ severity, className }: { severity: Severity; className?: string }) {
  return <span data-sev={severity} className={cn('sev-dot', className)} aria-hidden />
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span data-sev={severity} className="chip sev-tint sev-text">
      <span className="sev-dot" aria-hidden />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

/**
 * The counts, as a bar.
 *
 * Deliberately not a score. The bar shows how many findings there are at each
 * level and nothing else: there is no total, no percentage and no target,
 * because a custody plan that scores 87 is not a thing, and a number invites
 * the user to optimise it rather than read the list.
 */
export function SeverityBar({
  counts,
  onSelect,
  selected,
}: {
  counts: Record<Severity, number>
  onSelect?: (severity: Severity | null) => void
  selected?: Severity | null
}) {
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
  const total = order.reduce((sum, severity) => sum + counts[severity], 0)
  if (total === 0) {
    return (
      <p className="text-sm text-muted">
        No findings. That means this program could not find a problem, which is a smaller claim than
        it sounds like.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.map((severity) => {
        const count = counts[severity]
        if (count === 0) return null
        const active = selected === severity
        return (
          <button
            key={severity}
            type="button"
            data-sev={severity}
            onClick={() => onSelect?.(active ? null : severity)}
            className={cn(
              'chip sev-tint transition-opacity',
              onSelect ? 'cursor-pointer' : 'cursor-default',
              selected && !active && 'opacity-40'
            )}
          >
            <span className="sev-dot" aria-hidden />
            <span className="sev-text font-semibold">{count}</span>
            <span className="text-muted">{SEVERITY_LABEL[severity].toLowerCase()}</span>
          </button>
        )
      })}
    </div>
  )
}
