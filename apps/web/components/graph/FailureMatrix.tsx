'use client'

import { useMemo, useState } from 'react'
import type { ScenarioResult, Verdict, Wallet } from '@outlive/core'
import { Segmented } from '@/components/ui/Field.tsx'
import { WORLD_GROUPS } from '@/components/graph/Lens.tsx'
import { VERDICT, VERDICT_ORDER } from '@/lib/verdict.ts'
import { cn } from '@/lib/cn.ts'

/**
 * Every world against every wallet, on one screen.
 *
 * The map answers one world at a time, which is the right resolution for
 * understanding a failure and the wrong one for seeing the shape of all of
 * them. A column of red down one wallet, or one row that takes everything,
 * is a fact about the plan that no single drawing shows. So this is the index
 * into the map rather than a second answer: every cell is a verdict the rail
 * beside the drawing also gives, and clicking one draws that world.
 *
 * It is a real table, so a screen reader walks it by row and column and hears
 * the wallet, the world and the verdict for each cell. Each verdict is a glyph
 * and a word as well as a colour.
 */
export function FailureMatrix({
  results,
  wallets,
  onPick,
  className,
}: {
  results: ScenarioResult[]
  wallets: Wallet[]
  /** A scenario id. */
  onPick: (id: string) => void
  className?: string
}) {
  const [filter, setFilter] = useState<'bad' | 'all'>('bad')
  const [hover, setHover] = useState<{ row: string; col: string | null } | null>(null)

  const groups = useMemo(
    () =>
      WORLD_GROUPS.map((group) => ({
        label: group.label,
        rows: results.filter(
          (result) =>
            group.kinds.includes(result.scenario.kind) && (filter === 'all' || result.alarming)
        ),
      })).filter((group) => group.rows.length > 0),
    [results, filter]
  )

  const used = useMemo(() => {
    const seen = new Set<Verdict>()
    for (const group of groups)
      for (const row of group.rows) for (const outcome of row.wallets) seen.add(outcome.verdict)
    return VERDICT_ORDER.filter((verdict) => seen.has(verdict))
  }, [groups])

  const alarming = results.filter((result) => result.alarming).length
  const walletLabel = (id: string) => wallets.find((wallet) => wallet.id === id)?.label ?? id

  const readout = (() => {
    if (!hover) return null
    const result = results.find((entry) => entry.scenario.id === hover.row)
    if (!result) return null
    if (hover.col === null) return `${result.scenario.label}. Click to draw this world.`
    const outcome = result.wallets.find((entry) => entry.walletId === hover.col)
    if (!outcome) return null
    return `${result.scenario.label}: ${walletLabel(outcome.walletId)} ${VERDICT[outcome.verdict].label}. Click to draw it.`
  })()

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'bad', label: `What breaks ${alarming}` },
            { value: 'all', label: `All ${results.length}` },
          ]}
        />
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted">
          {used.map((verdict) => {
            const Icon = VERDICT[verdict].icon
            return (
              <li key={verdict} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-[4px] border',
                    VERDICT[verdict].cell
                  )}
                >
                  <Icon className="size-2.5" strokeWidth={3} aria-hidden />
                </span>
                {VERDICT[verdict].label}
              </li>
            )
          })}
        </ul>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          No single thing going wrong leaves a wallet unspendable or spendable by somebody else.
          That is a smaller claim than it sounds: show all {results.length} to see the working.
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1" onMouseLeave={() => setHover(null)}>
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              What each world does to each wallet. Click a cell to draw that world on the map.
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
                    className={cn(
                      'max-w-[7rem] truncate px-1 pb-1 text-center text-[0.6875rem] font-medium transition-colors',
                      hover?.col === wallet.id ? 'text-strong' : 'text-muted'
                    )}
                    title={wallet.label}
                  >
                    {wallet.label}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.label}>
                <tr>
                  <th colSpan={wallets.length + 1} scope="colgroup" className="pt-2 text-left">
                    <span className="eyebrow">{group.label}</span>
                  </th>
                </tr>
                {group.rows.map((result) => {
                  const rowLit = hover?.row === result.scenario.id
                  return (
                    <tr key={result.scenario.id}>
                      <th
                        scope="row"
                        className={cn(
                          'w-full max-w-0 rounded-l-[6px] py-[2px] pl-1 pr-3 font-normal transition-colors',
                          rowLit && 'bg-[rgb(var(--tint)/0.045)]'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onPick(result.scenario.id)}
                          onMouseEnter={() => setHover({ row: result.scenario.id, col: null })}
                          onFocus={() => setHover({ row: result.scenario.id, col: null })}
                          className={cn(
                            'block w-full truncate rounded-[4px] px-1 text-left text-[0.8125rem] leading-7 transition-colors',
                            rowLit ? 'text-strong' : 'text-body'
                          )}
                          title={result.scenario.label}
                        >
                          {result.scenario.label}
                        </button>
                      </th>
                      {wallets.map((wallet) => {
                        const outcome = result.wallets.find((entry) => entry.walletId === wallet.id)
                        if (!outcome) return <td key={wallet.id} />
                        const verdict = VERDICT[outcome.verdict]
                        const Icon = verdict.icon
                        const lit = rowLit || hover?.col === wallet.id
                        return (
                          <td
                            key={wallet.id}
                            className={cn(
                              'px-[2px] py-[2px] text-center transition-colors last:rounded-r-[6px] last:pr-1',
                              (rowLit || hover?.col === wallet.id) && 'bg-[rgb(var(--tint)/0.045)]'
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => onPick(result.scenario.id)}
                              onMouseEnter={() =>
                                setHover({ row: result.scenario.id, col: wallet.id })
                              }
                              onFocus={() => setHover({ row: result.scenario.id, col: wallet.id })}
                              title={`${result.scenario.label}: ${wallet.label} ${verdict.label}`}
                              className={cn(
                                'mx-auto flex h-7 w-full min-w-14 items-center justify-center rounded-[5px] border transition-[transform,box-shadow,opacity]',
                                verdict.cell,
                                hover && !lit && 'opacity-55',
                                hover?.row === result.scenario.id &&
                                  hover.col === wallet.id &&
                                  'scale-110 shadow-[0_0_0_2px_var(--c-surface),0_0_0_3px_currentColor]'
                              )}
                            >
                              <Icon className="size-3.5" strokeWidth={2.5} aria-hidden />
                              <span className="sr-only">
                                {wallet.label}: {verdict.label}
                              </span>
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <p className="mt-2 min-h-[1.25rem] text-xs text-faint" aria-live="polite">
        {readout ?? 'Point at a cell for what it says. Click one to draw that world.'}
      </p>
    </div>
  )
}
