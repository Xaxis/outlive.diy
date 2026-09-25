'use client'

import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { ScenarioResult, Verdict, Wallet } from '@outlive/core'
import { Segmented } from '@/components/ui/Field.tsx'
import { VERDICT } from '@/lib/verdict.ts'
import { cn } from '@/lib/cn.ts'

/**
 * What a change did to every world, cell by cell.
 *
 * The findings delta says which sentences a change closed and opened. It does
 * not say which events the plan now survives that it did not, and that is the
 * question somebody moving a key to another city is actually asking. So the
 * two runs are laid over each other: one row per world either plan has, one
 * column per wallet either plan has, and each cell the verdict before and after.
 *
 * Worlds and wallets are matched by id, which a fork keeps. A world only one
 * side has is shown with nothing on the other side rather than guessed at.
 */

const RANK: Record<Verdict, number> = { safe: 0, degraded: 1, lost: 2, exposed: 2 }

type Change = 'better' | 'worse' | 'same' | 'new' | 'gone'

export function WorldDiff({
  before,
  after,
  wallets,
}: {
  before: ScenarioResult[]
  after: ScenarioResult[]
  /** Both plans' wallets, deduplicated by id, in the order to draw them. */
  wallets: Wallet[]
}) {
  const [filter, setFilter] = useState<'changed' | 'all'>('changed')

  const rows = useMemo(() => {
    const was = new Map(before.map((result) => [result.scenario.id, result]))
    const now = new Map(after.map((result) => [result.scenario.id, result]))
    const ids = [
      ...new Set([...after.map((r) => r.scenario.id), ...before.map((r) => r.scenario.id)]),
    ]
    return ids.map((id) => {
      const a = was.get(id) ?? null
      const b = now.get(id) ?? null
      const cells = wallets.map((wallet) => {
        const from = a?.wallets.find((entry) => entry.walletId === wallet.id)?.verdict ?? null
        const to = b?.wallets.find((entry) => entry.walletId === wallet.id)?.verdict ?? null
        let change: Change = 'same'
        if (from === null && to !== null) change = 'new'
        else if (from !== null && to === null) change = 'gone'
        else if (from !== null && to !== null && from !== to)
          change = RANK[to] < RANK[from] ? 'better' : RANK[to] > RANK[from] ? 'worse' : 'same'
        return { walletId: wallet.id, from, to, change }
      })
      return {
        id,
        label: (b ?? a)!.scenario.label,
        cells,
        changed: cells.some((cell) => cell.change !== 'same' || cell.from !== cell.to),
      }
    })
  }, [before, after, wallets])

  const visible = filter === 'all' ? rows : rows.filter((row) => row.changed)
  const better = rows.flatMap((row) => row.cells).filter((cell) => cell.change === 'better').length
  const worse = rows.flatMap((row) => row.cells).filter((cell) => cell.change === 'worse').length

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'changed', label: `Changed ${rows.filter((row) => row.changed).length}` },
            { value: 'all', label: `All ${rows.length}` },
          ]}
        />
        <p className="text-xs text-muted">
          <span className="font-medium text-ok">{better} better</span>
          {' · '}
          <span className={cn('font-medium', worse > 0 ? 'text-critical' : 'text-muted')}>
            {worse} worse
          </span>
          <span className="text-faint"> (a cell is one wallet in one world)</span>
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          No world gives a different answer for any wallet. Whatever changed, it did not change what
          survives what.
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Each world&apos;s verdict for each wallet, in the baseline and in this plan.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  World
                </th>
                {wallets.map((wallet) => (
                  <th
                    key={wallet.id}
                    scope="col"
                    title={wallet.label}
                    className="max-w-[8rem] truncate px-1 pb-1 text-center text-[0.6875rem] font-medium text-muted"
                  >
                    {wallet.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t border-line first:border-t-0">
                  <th
                    scope="row"
                    className="w-full min-w-[9rem] py-1.5 pr-3 text-[0.8125rem] font-normal leading-snug text-body sm:max-w-0 sm:truncate"
                    title={row.label}
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.walletId} className="px-1 py-1.5">
                      <span
                        className={cn(
                          'mx-auto flex w-fit items-center gap-1 rounded-[6px] border px-1 py-0.5',
                          cell.change === 'better' && 'border-ok/60 bg-ok/5',
                          cell.change === 'worse' && 'border-critical/70 bg-critical/5',
                          (cell.change === 'same' ||
                            cell.change === 'new' ||
                            cell.change === 'gone') &&
                            'border-transparent'
                        )}
                      >
                        <Glyph verdict={cell.from} />
                        <ArrowRight className="size-3 text-faint" aria-hidden />
                        <Glyph verdict={cell.to} />
                        <span className="sr-only">
                          {cell.from ? VERDICT[cell.from].label : 'not in the baseline'} before,{' '}
                          {cell.to ? VERDICT[cell.to].label : 'not in this plan'} now
                          {cell.change === 'better' || cell.change === 'worse'
                            ? `, ${cell.change}`
                            : ''}
                          .
                        </span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Glyph({ verdict }: { verdict: Verdict | null }) {
  if (!verdict)
    return (
      <span
        className="flex size-6 items-center justify-center rounded-[5px] border border-dashed border-line-strong text-[0.625rem] text-faint"
        aria-hidden
      >
        –
      </span>
    )
  const Icon = VERDICT[verdict].icon
  return (
    <span
      className={cn(
        'flex size-6 items-center justify-center rounded-[5px] border',
        VERDICT[verdict].cell
      )}
      title={VERDICT[verdict].label}
      aria-hidden
    >
      <Icon className="size-3" strokeWidth={2.5} />
    </span>
  )
}
