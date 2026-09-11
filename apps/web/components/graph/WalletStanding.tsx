'use client'

import { useMemo } from 'react'
import { CircleAlert, CircleCheck, CircleSlash, Clock } from 'lucide-react'
import {
  describeDuration,
  evaluateWallet,
  recoveryTiming,
  type Plan,
  type World,
} from '@outlive/core'
import { QuorumBar } from './QuorumBar.tsx'
import { useStore } from '@/lib/store.ts'
import { navigateTo } from '@/lib/router.ts'
import { SECTION_FOR } from '@/lib/sections.ts'
import { cn } from '@/lib/cn.ts'

/** How many gaps are listed before the list starts counting instead. */
const GAP_LIMIT = 4

/**
 * Where each wallet stands in one world, with how long getting there takes.
 *
 * The verdict flips meaning with the actor. "Spendable" is the answer you want
 * when the question is whether you can recover, and the worst thing on the page
 * when the question is whether somebody standing in one room can help
 * themselves, so the wording and the icon both change rather than only the
 * colour.
 */
export function WalletStanding({
  plan,
  world,
  onSelect,
  className,
}: {
  plan: Plan
  world: World
  onSelect?: (walletId: string) => void
  className?: string
}) {
  const adversary = world.actor === 'adversary'
  const select = useStore((state) => state.select)
  const rows = useMemo(
    () =>
      plan.wallets.map((wallet) => ({
        wallet,
        availability: evaluateWallet(plan, wallet, world),
        timing: recoveryTiming(plan, wallet, world),
      })),
    [plan, world]
  )

  // One list across every wallet: the same unrecorded place blocks two of them
  // as often as not, and saying it twice is saying it once too many.
  const gaps = adversary
    ? []
    : [
        ...new Map(
          rows
            .filter((row) => row.timing.possible)
            .flatMap((row) => row.timing.unknowns)
            .map((unknown) => [unknown.note, unknown])
        ).values(),
      ]

  if (rows.length === 0) return null

  return (
    <ul
      className={cn('grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-line', className)}
    >
      {rows.map(({ wallet, availability, timing }) => {
        const best =
          availability.paths.find((path) => path.pathId === availability.viaPathId) ??
          availability.paths[0]
        const keyLabels = best
          ? (plan.wallets
              .find((entry) => entry.id === wallet.id)
              ?.paths.find((path) => path.id === best.pathId)
              ?.keyIds.map((id) => ({
                id,
                label: plan.keys.find((key) => key.id === id)?.label ?? id,
              })) ?? [])
          : []

        const exposed = adversary && availability.spendable
        const lost = !adversary && !availability.spendable
        const Icon = exposed ? CircleAlert : lost ? CircleSlash : CircleCheck
        const verdict = adversary
          ? availability.spendable
            ? 'they can spend it'
            : 'they cannot spend it'
          : availability.spendable
            ? availability.margin > 0
              ? 'spendable'
              : 'spendable, no spare'
            : 'unspendable'

        return (
          <li key={wallet.id} className="bg-surface">
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(wallet.id)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-3 text-left transition-colors enabled:hover:bg-[rgb(var(--tint)/0.03)] disabled:cursor-default"
            >
              <span className="min-w-[8rem] flex-1">
                <span className="block text-[0.8125rem] font-medium text-strong">
                  {wallet.label}
                </span>
                <span className="mono block text-[0.6875rem] text-faint">
                  {wallet.tier}
                  {wallet.decoy ? ' · decoy' : ''}
                </span>
              </span>

              {best && keyLabels.length > 0 ? (
                <QuorumBar path={best} keyLabels={keyLabels} />
              ) : null}

              <span
                className={cn(
                  'flex items-center gap-1.5 text-[0.8125rem]',
                  exposed || lost ? 'text-critical' : 'text-ok'
                )}
              >
                <Icon className="size-4 flex-none" aria-hidden />
                {verdict}
              </span>

              {/* Time only means anything when the answer is that you can get
                  there. For an adversary it is not a comfort worth printing. */}
              {!adversary && timing.possible ? (
                <span className="flex items-center gap-1.5 text-[0.75rem] text-muted">
                  <Clock className="size-3.5 flex-none text-faint" aria-hidden />
                  {describeDuration(timing.days, timing.travelMinutes)}
                  {/* Separated, because the duration ends in a clause: "no
                      travel at least" says something else entirely. */}
                  {timing.unknowns.length > 0 ? (
                    <span className="text-faint">· at least</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}

      {/* What the floors are floors because of, and where to go about it.
          These used to live in the tooltip on the words "at least", which is
          not a place a reader finds anything and not a place a finger can
          reach at all. */}
      {gaps.length > 0 ? (
        <li className="bg-surface p-3 no-print">
          <p className="text-xs leading-relaxed text-muted">
            Those are floors rather than estimates.{' '}
            {gaps.length === 1 ? 'One thing' : `${gaps.length} things`} the plan does not record
            would change them:
          </p>
          <ul className="mt-1.5 grid gap-1">
            {gaps.slice(0, GAP_LIMIT).map((gap) => {
              const subject = gap.subject
              return (
                <li key={gap.note} className="text-xs leading-snug text-faint">
                  {gap.note}
                  {subject ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => {
                          select(subject)
                          navigateTo('design', SECTION_FOR[subject.type])
                        }}
                        className="link"
                      >
                        Record it
                      </button>
                    </>
                  ) : null}
                </li>
              )
            })}
            {gaps.length > GAP_LIMIT ? (
              <li className="text-xs text-faint">and {gaps.length - GAP_LIMIT} more.</li>
            ) : null}
          </ul>
        </li>
      ) : null}
    </ul>
  )
}
