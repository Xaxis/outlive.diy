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
    <div className="no-print mb-5 flex items-center gap-3 rounded-[var(--radius-control)] border border-accent/30 bg-accent/[0.06] px-3 py-1.5 text-xs text-muted">
      <p className="min-w-0 flex-1">
        <span className="font-medium text-strong">Structure, not advice.</span> No findings means
        nothing this program has a rule for, not that the plan is safe.
      </p>
      <Button variant="ghost" size="sm" aria-label="Understood" onClick={acknowledge}>
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}
