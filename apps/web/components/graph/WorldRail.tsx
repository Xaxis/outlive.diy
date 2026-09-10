'use client'

import { useState, type ReactNode } from 'react'
import type { Scenario, ScenarioResult, Verdict, Wallet } from '@outlive/core'
import { Segmented } from '@/components/ui/Field.tsx'
import { cn } from '@/lib/cn.ts'
import { TODAY } from './Lens.tsx'

/**
 * Every world the engine can build, as a list you pick from, beside the picture
 * it draws.
 *
 * This used to be a page of its own: a table of scenarios against wallets, with
 * the drawing hidden behind a row you had to open. Two pages asking the same
 * question, and the one with the answer in it was the one you had to go looking
 * for. So the table became this, and the picture became the page.
 *
 * The verdicts are still here, one square per wallet, which is the column of
 * red down a single wallet that the table existed to show. They are never the
 * only thing carrying the news: each row also says in words what breaks, and
 * every square names its wallet and its verdict to a screen reader.
 */

const VERDICT: Record<Verdict, { label: string; tone: string }> = {
  safe: { label: 'survives', tone: 'bg-ok' },
  degraded: { label: 'no spare', tone: 'bg-medium' },
  lost: { label: 'unspendable', tone: 'bg-critical' },
  exposed: { label: 'they can spend it', tone: 'bg-critical' },
}

/** How many wallet squares fit on a row before it starts counting instead. */
const DOT_LIMIT = 6

function summarise(result: ScenarioResult, wallets: Wallet[]): string {
  const name = (id: string) => wallets.find((wallet) => wallet.id === id)?.label ?? id
  const exposed = result.wallets.filter((entry) => entry.verdict === 'exposed')
  const lost = result.wallets.filter((entry) => entry.verdict === 'lost')
  const degraded = result.wallets.filter((entry) => entry.verdict === 'degraded')

  const parts: string[] = []
  if (exposed.length > 0) {
    parts.push(
      exposed.length === 1
        ? `${name(exposed[0].walletId)} is theirs to spend`
        : `${exposed.length} wallets are theirs to spend`
    )
  }
  if (lost.length > 0) {
    parts.push(
      lost.length === 1 ? `${name(lost[0].walletId)} unspendable` : `${lost.length} unspendable`
    )
  }
  // Only worth saying when nothing worse happened. "No spare" beside
  // "unspendable" is a detail nobody reads.
  if (parts.length === 0 && degraded.length > 0) {
    parts.push(
      degraded.length === 1
        ? `${name(degraded[0].walletId)} left with no spare`
        : `${degraded.length} left with no spare`
    )
  }
  return parts.join(', ') || 'everything survives'
}

function Dots({ result, wallets }: { result: ScenarioResult; wallets: Wallet[] }) {
  const shown = result.wallets.slice(0, DOT_LIMIT)
  return (
    <span className="flex flex-none items-center gap-[3px]">
      {shown.map((outcome) => {
        const wallet = wallets.find((entry) => entry.id === outcome.walletId)
        const verdict = VERDICT[outcome.verdict]
        return (
          <span
            key={outcome.walletId}
            title={`${wallet?.label ?? outcome.walletId}: ${verdict.label}`}
            className={cn('size-1.5 rounded-[2px]', verdict.tone)}
          >
            <span className="sr-only">
              {wallet?.label ?? outcome.walletId}: {verdict.label}.
            </span>
          </span>
        )
      })}
      {result.wallets.length > shown.length ? (
        <span className="text-[0.625rem] text-faint">+{result.wallets.length - shown.length}</span>
      ) : null}
    </span>
  )
}

export function WorldRail({
  groups,
  results,
  wallets,
  activeId,
  onPick,
  className,
  children,
}: {
  groups: { label: string; scenarios: Scenario[] }[]
  /** Keyed by scenario id. */
  results: Map<string, ScenarioResult>
  wallets: Wallet[]
  /** The world being drawn, or null while a composed one is. */
  activeId: string | null
  onPick: (id: string) => void
  className?: string
  /** The composer, folded away at the bottom. */
  children?: ReactNode
}) {
  const [filter, setFilter] = useState<'bad' | 'all'>('bad')

  const visible = groups
    .map((group) => ({
      label: group.label,
      scenarios: group.scenarios.filter(
        (scenario) => filter === 'all' || results.get(scenario.id)?.alarming === true
      ),
    }))
    .filter((group) => group.scenarios.length > 0)

  const total = groups.reduce((count, group) => count + group.scenarios.length, 0)
  const shown = visible.reduce((count, group) => count + group.scenarios.length, 0)

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="border-b border-line p-2.5 no-print">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'bad', label: 'What breaks' },
            { value: 'all', label: `All ${total}` },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <Row
          label="As it stands"
          detail="nothing wrong, everything in reach"
          active={activeId === TODAY}
          onClick={() => onPick(TODAY)}
        />

        {visible.map((group) => (
          <div key={group.label} className="mt-3">
            <p className="eyebrow px-1.5 pb-1">{group.label}</p>
            <ul>
              {group.scenarios.map((scenario) => {
                const result = results.get(scenario.id)
                return (
                  <li key={scenario.id}>
                    <Row
                      label={scenario.label}
                      detail={result ? summarise(result, wallets) : scenario.question}
                      dots={result ? <Dots result={result} wallets={wallets} /> : null}
                      active={activeId === scenario.id}
                      onClick={() => onPick(scenario.id)}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {shown === 0 ? (
          <p className="px-1.5 py-3 text-xs leading-relaxed text-faint">
            No single thing going wrong leaves a wallet unspendable or spendable by somebody else.
            That is a smaller claim than it sounds: switch to all {total} to see the working, and
            compose one below to take several things at once.
          </p>
        ) : null}

        {children ? <div className="mt-3 border-t border-line px-1.5 pt-3">{children}</div> : null}
      </div>
    </div>
  )
}

function Row({
  label,
  detail,
  dots,
  active,
  onClick,
}: {
  label: string
  detail: string
  dots?: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'block w-full rounded-[var(--radius-control)] px-1.5 py-1.5 text-left transition-colors',
        active
          ? 'bg-accent/10 shadow-[inset_2px_0_0_0_var(--c-accent)]'
          : 'hover:bg-[rgb(var(--tint)/0.04)]'
      )}
    >
      <span
        className={cn(
          'block truncate text-[0.8125rem] leading-snug',
          active ? 'font-medium text-strong' : 'text-body'
        )}
      >
        {label}
      </span>
      <span className="mt-0.5 flex items-center gap-1.5">
        {dots}
        {/* A row that is current sits on a tenth of the accent, and the faint
            step of the ramp does not clear 4.5:1 against that ground. */}
        <span className={cn('truncate text-[0.6875rem]', active ? 'text-muted' : 'text-faint')}>
          {detail}
        </span>
      </span>
    </button>
  )
}
