'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Wand2 } from 'lucide-react'
import { compareReports, improve, newId, type Plan } from '@outlive/core'
import { reportFor } from '@/lib/analysis.ts'
import { Button } from '@/components/ui/Button.tsx'
import { baseName, useStore } from '@/lib/store.ts'
import { nextMoveFor } from '@/components/findings/NextMove.tsx'
import { netChange } from '@/lib/net.ts'
import { navigateTo } from '@/lib/router.ts'

/**
 * Every structural fix the engine can find, applied in order, as a draft.
 *
 * Never to the plan itself: the result is a proposal, and the page it lands
 * on is the comparison, which is where a reader decides whether the trade is
 * one they want. Records of things done are never made on the reader's
 * behalf, so this only ever moves, adds and copies.
 */
export function ImproveButton({
  plan,
  label = 'Fix all in a draft',
}: {
  plan: Plan
  label?: string
}) {
  const addPlan = useStore((state) => state.addPlan)
  const setCompare = useStore((state) => state.setCompare)
  const notify = useStore((state) => state.notify)
  const [busy, setBusy] = useState(false)

  // Beside "no single change closes more than it opens", a primary button
  // promising fixes contradicted the panel under it and led to a toast saying
  // there were none. It looks after a paint, from the same search, and stays
  // away when there is nothing to offer.
  const [nothing, setNothing] = useState<Plan | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (nextMoveFor(plan).steps.length === 0) setNothing(plan)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [plan])
  if (nothing === plan) return null

  return (
    <Button
      variant="primary"
      disabled={busy}
      icon={
        busy ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Wand2 className="size-3.5" aria-hidden />
        )
      }
      onClick={() => {
        setBusy(true)
        // After a paint, so the button says it is working before the search
        // holds the thread.
        window.setTimeout(() => {
          const result = improve(plan)
          setBusy(false)
          if (result.steps.length === 0) {
            notify({
              tone: 'warn',
              message: 'No change found that helps',
              detail: 'Nothing this program can move or add closes more than it opens.',
            })
            return
          }
          const baseline = plan.id
          const delta = compareReports(reportFor(plan), reportFor(result.plan))
          addPlan({
            ...result.plan,
            id: newId('plan'),
            kind: 'draft',
            name: `${baseName(plan.name)}, fixed`,
          })
          setCompare(baseline)
          notify({
            tone: 'ok',
            message: `Draft made with ${result.steps.length} ${result.steps.length === 1 ? 'change' : 'changes'}`,
            // Counted from the two plans, as the comparison it lands on
            // counts them. Summing the steps counted a finding one step
            // opened and the next closed on both sides.
            detail: `${netChange(delta.resolved.length, delta.introduced.length)} Your plan is unchanged until you use this version.`,
          })
          navigateTo('compare')
        }, 30)
      }}
    >
      {busy ? 'Trying changes…' : label}
    </Button>
  )
}
