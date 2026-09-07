'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, ClipboardCheck } from 'lucide-react'
import { createVerification, today, type RecoveryRoute, type VerificationKind } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { useStore } from '@/lib/store.ts'
import { cn } from '@/lib/cn.ts'

/**
 * Walking a recovery route on purpose, before you have to.
 *
 * The ticking is deliberately not saved: a rehearsal is a single sitting, and a
 * half-ticked drill left in the file for two years would be a worse lie than no
 * record at all. What *is* saved is the outcome, as a dated verification, which
 * is the only part that changes what the analysis believes.
 */
export function Rehearsal({ route }: { route: RecoveryRoute }) {
  const [active, setActive] = useState(false)
  const [done, setDone] = useState<Set<number>>(new Set())
  const edit = useStore((state) => state.edit)
  const notify = useStore((state) => state.notify)

  const complete = route.steps.length > 0 && done.size === route.steps.length

  const record = () => {
    const kind: VerificationKind = route.scenarioId.startsWith('user-death')
      ? 'successor-dry-run'
      : 'recovery-drill'
    edit((plan) => {
      plan.verifications.push(
        createVerification({
          kind,
          subject: { type: 'plan', id: plan.id },
          lastVerifiedAt: today(),
          notes: `Rehearsed: ${route.title}`,
        })
      )
    })
    setActive(false)
    setDone(new Set())
    notify({
      tone: 'ok',
      message: 'Recorded as done today',
      detail:
        'The staleness analysis now treats this route as tested rather than assumed, and will say so again when it is due.',
    })
  }

  // A route with no steps has nothing to walk, and a disabled button beside a
  // finding that already says "no route" is noise on top of bad news.
  if (route.steps.length === 0) return null

  if (!active) {
    return (
      <div className="no-print mt-4 border-t border-line pt-3">
        <Button
          size="sm"
          icon={<ClipboardCheck className="size-3.5" aria-hidden />}
          onClick={() => setActive(true)}
        >
          Rehearse this route
        </Button>
      </div>
    )
  }

  return (
    <div className="no-print mt-4 border-t border-line pt-3">
      <p className="mb-2 text-xs leading-relaxed text-faint">
        Tick each step as you actually do it, on a throwaway wallet or with the real containers.
        Nothing here is saved except the fact that you finished.
      </p>
      <ul className="space-y-1.5">
        {route.steps.map((step, position) => {
          const ticked = done.has(position)
          return (
            <li key={`${route.scenarioId}-rehearse-${position}`}>
              <button
                type="button"
                aria-pressed={ticked}
                onClick={() =>
                  setDone((current) => {
                    const next = new Set(current)
                    if (next.has(position)) next.delete(position)
                    else next.add(position)
                    return next
                  })
                }
                className="flex w-full items-start gap-2 text-left"
              >
                {ticked ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 flex-none text-ok" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 size-3.5 flex-none text-faint" aria-hidden />
                )}
                <span
                  className={cn(
                    'text-[0.8125rem] leading-snug',
                    ticked ? 'text-faint line-through' : 'text-body'
                  )}
                >
                  {step.title}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={!complete} onClick={record}>
          {complete ? 'Record this as done today' : `${done.size} of ${route.steps.length} done`}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActive(false)
            setDone(new Set())
          }}
        >
          Stop
        </Button>
      </div>
    </div>
  )
}
