'use client'

import { useState } from 'react'
import { LoaderCircle, Wand2 } from 'lucide-react'
import { improve, newId, type Plan } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { baseName, useStore } from '@/lib/store.ts'
import { knownNextMove } from '@/components/findings/NextMove.tsx'
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

  // Where the overview already looked and found nothing structural, a button
  // promising fixes would only lead to a toast saying there are none.
  if (knownNextMove(plan)?.steps.length === 0) return null

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
            detail: `${netChange(
              result.steps.reduce((sum, step) => sum + step.closes.length, 0),
              result.steps.reduce((sum, step) => sum + step.opens.length, 0)
            )} Your plan is unchanged until you use this version.`,
          })
          navigateTo('compare')
        }, 30)
      }}
    >
      {busy ? 'Trying changes…' : label}
    </Button>
  )
}
