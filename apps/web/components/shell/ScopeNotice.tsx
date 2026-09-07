'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button.tsx'
import { useStore } from '@/lib/store.ts'

/**
 * Said once, and then never again.
 *
 * Repeating a disclaimer on every screen teaches people to stop reading
 * disclaimers, which is the opposite of what this one is for. It appears the
 * first time there is a plan to be wrong about, and dismissing it is permanent.
 */
export function ScopeNotice() {
  const acknowledged = useStore((state) => state.preferences.scopeAcknowledged)
  const acknowledge = useStore((state) => state.acknowledgeScope)
  if (acknowledged) return null

  return (
    <div className="no-print mb-6 flex gap-3 rounded-[var(--radius-card)] border border-accent/30 bg-accent/[0.06] p-4">
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
        <p className="font-medium text-strong">Before you rely on any of this</p>
        <p className="mt-1">
          This models structure. It does not know your real threat, cannot verify anything you tell
          it, and is not advice. It only knows the failure modes it has rules for, so a plan with no
          findings is a plan this program could not find a problem with, which is a much smaller
          claim than it sounds like. You will not be shown this again.
        </p>
      </div>
      <Button variant="ghost" size="sm" aria-label="Understood" onClick={acknowledge}>
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
