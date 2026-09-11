'use client'

import { href } from '@/lib/router.ts'

/**
 * What every screen says about a plan that describes nothing.
 *
 * These pages are all derived, so an empty plan makes them technically correct
 * and completely misleading: a runbook with two steps, a findings list with no
 * findings. Silence from a program that has been given nothing is not
 * reassurance, and saying so in the same words everywhere is the difference
 * between an empty screen and a screen that is waiting for you.
 */
export function NothingYet({ what }: { what: string }) {
  return (
    <div className="card max-w-2xl border-dashed p-6">
      <h2 className="text-sm font-semibold text-strong">Nothing to work from yet</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        This plan is empty, so {what} Describe the places, the keys and the wallets first, and this
        page writes itself.
      </p>
      <div className="mt-4">
        <a href={href('design')} className="btn btn-primary no-underline">
          Start describing it
        </a>
      </div>
    </div>
  )
}
