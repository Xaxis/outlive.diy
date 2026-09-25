'use client'

import { netChange } from '@/lib/net.ts'
import { useEffect, useState } from 'react'
import { Check, LoaderCircle, Wand2 } from 'lucide-react'
import { fixesFor, type Plan, type RankedFix } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { useStore } from '@/lib/store.ts'

/**
 * The fix, found and ready to apply.
 *
 * The remediation sentence says what kind of change would help. This says
 * which change, exactly, and what it does to every other finding, because the
 * engine has already tried it. Searching takes a few hundred milliseconds, so
 * it starts after the card has opened rather than holding the click up.
 *
 * Applying is one undo step. A record ("I restored this today") is labelled
 * as what it is, a statement about the world, and says so on its button.
 */
export function FixList({
  plan,
  findingId,
  onFound,
}: {
  plan: Plan
  findingId: string
  /** How many tested fixes there are, once the search is done. */
  onFound?: (count: number) => void
}) {
  const applyPlan = useStore((state) => state.applyPlan)
  const notify = useStore((state) => state.notify)
  const [fixes, setFixes] = useState<RankedFix[] | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const found = fixesFor(plan, findingId)
      setFixes(found)
      onFound?.(found.length)
    }, 30)
    return () => window.clearTimeout(timer)
  }, [plan, findingId, onFound])

  if (fixes === null) {
    return (
      <p className="no-print mt-3 flex items-center gap-2 text-xs text-faint">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        Trying changes against the analysis…
      </p>
    )
  }
  if (fixes.length === 0) return null

  return (
    <div className="no-print mt-3 rounded-[var(--radius-control)] border border-accent/30 bg-accent/[0.05] p-2.5">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-strong">
        <Wand2 className="size-3.5 text-accent" aria-hidden />
        {fixes.length === 1
          ? 'A fix, tried against the whole analysis'
          : 'Fixes, tried against the whole analysis'}
      </p>
      <ul className="space-y-1.5">
        {fixes.map((result) => (
          <li
            key={result.fix.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[6px] bg-surface px-2.5 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] leading-snug text-body">
                {result.fix.label}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-faint">
                <span className="text-ok">closes {result.closes.length}</span>
                {result.opens.length > 0 ? (
                  // Named, because "opens 1" is a trade nobody can weigh
                  // without knowing what the one is.
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {result.opens.slice(0, 2).map((finding) => (
                      <span key={finding.id} className="flex items-center gap-1">
                        <SeverityDot severity={finding.severity} />
                        opens {finding.title.charAt(0).toLowerCase() + finding.title.slice(1)}
                      </span>
                    ))}
                    {result.opens.length > 2 ? (
                      <span>and {result.opens.length - 2} more</span>
                    ) : null}
                  </span>
                ) : (
                  <span>opens nothing</span>
                )}
              </span>
            </span>
            <Button
              size="sm"
              variant={result.fix.kind === 'record' ? 'default' : 'primary'}
              icon={<Check className="size-3.5" aria-hidden />}
              onClick={() => {
                applyPlan(result.plan)
                notify({
                  tone: 'ok',
                  message: result.fix.kind === 'record' ? 'Recorded' : 'Applied',
                  detail: netChange(result.closes.length, result.opens.length),
                  undoable: true,
                })
              }}
            >
              {result.fix.kind === 'record' ? 'Record it' : 'Apply'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
