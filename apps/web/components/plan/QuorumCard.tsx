'use client'

import { KeyRound, Minus, Plus } from 'lucide-react'
import type { Plan, SpendPath } from '@outlive/core'
import { useStore } from '@/lib/store.ts'
import { cn } from '@/lib/cn.ts'
import { Disclosure } from '@/components/ui/Disclosure.tsx'

/**
 * A way to spend, as the thing it is: some keys, and how many of them.
 *
 * It sat behind a collapsed row reading "2 of 3", and changing which keys
 * were in it meant opening the row and finding a list of checkboxes. The
 * quorum is the most important fact about a wallet, so it is always open:
 * every key as a chip you click in or out, and the number needed as a row of
 * keys, filled for the ones that must sign.
 */
export function QuorumCard({
  plan,
  walletId,
  path,
  children,
}: {
  plan: Plan
  walletId: string
  path: SpendPath
  /** The rest of the path, folded inside the card rather than listed again below it. */
  children?: React.ReactNode
}) {
  const edit = useStore((state) => state.edit)
  const inPath = new Set(path.keyIds)
  const n = path.keyIds.length

  const change = (recipe: (target: SpendPath) => void) =>
    edit((draft) => {
      const target = draft.wallets
        .find((entry) => entry.id === walletId)
        ?.paths.find((entry) => entry.id === path.id)
      if (!target) return
      recipe(target)
      // Never more needed than there are keys, and never none.
      target.threshold = Math.max(1, Math.min(target.threshold, Math.max(1, target.keyIds.length)))
    })

  return (
    <div className="rounded-[var(--radius-control)] border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-strong">
          {path.label}
          {path.timelockDays > 0 ? (
            <span className="ml-2 text-xs font-normal text-muted">
              opens after {path.timelockDays} days
            </span>
          ) : null}
        </p>
        <div
          className="flex items-center gap-2"
          role="group"
          aria-label={`${path.label}: keys needed`}
        >
          <button
            type="button"
            aria-label="Fewer keys needed"
            disabled={path.threshold <= 1}
            onClick={() => change((target) => (target.threshold -= 1))}
            className="flex size-6 items-center justify-center rounded border border-line text-muted hover:text-strong disabled:opacity-30"
          >
            <Minus className="size-3" aria-hidden />
          </button>
          <span className="flex items-center gap-0.5" aria-hidden>
            {Array.from({ length: Math.max(n, 1) }, (_, index) => (
              <KeyRound
                key={index}
                className={cn('size-3.5', index < path.threshold ? 'text-accent' : 'text-faint')}
                strokeWidth={index < path.threshold ? 2.5 : 1.5}
              />
            ))}
          </span>
          <span className="mono text-sm text-strong">
            {path.threshold} of {n}
          </span>
          <button
            type="button"
            aria-label="More keys needed"
            disabled={path.threshold >= n}
            onClick={() => change((target) => (target.threshold += 1))}
            className="flex size-6 items-center justify-center rounded border border-line text-muted hover:text-strong disabled:opacity-30"
          >
            <Plus className="size-3" aria-hidden />
          </button>
        </div>
      </div>
      <div
        className="mt-2.5 flex flex-wrap gap-1.5"
        role="group"
        aria-label={`${path.label}: keys in it`}
      >
        {plan.keys.map((key) => {
          const on = inPath.has(key.id)
          return (
            <button
              key={key.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                change((target) => {
                  target.keyIds = on
                    ? target.keyIds.filter((id) => id !== key.id)
                    : [...target.keyIds, key.id]
                })
              }
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                on
                  ? 'border-accent bg-accent/10 text-strong'
                  : 'border-dashed border-line text-faint hover:border-line-strong hover:text-muted'
              )}
            >
              <KeyRound className={cn('size-3', on ? 'text-accent' : 'text-faint')} aria-hidden />
              {key.label}
            </button>
          )
        })}
        {plan.keys.length === 0 ? (
          <span className="text-xs text-faint">No keys yet. Add them on the keys step.</span>
        ) : null}
      </div>
      {children ? (
        <Disclosure size="aside" title="Name, purpose, timelock" className="mt-3">
          <div className="mt-3 space-y-4">{children}</div>
        </Disclosure>
      ) : null}
    </div>
  )
}
