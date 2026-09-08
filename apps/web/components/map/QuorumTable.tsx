'use client'

import { useMemo } from 'react'
import { CircleDot, FileKey2, KeyRound, Lock, Puzzle, ShieldEllipsis } from 'lucide-react'
import { buildMap, createContext, indexPlan, type Holding, type Plan } from '@outlive/core'
import { Panel } from '@/components/ui/Surface.tsx'
import { describeTravel, TIER } from '@/lib/describe.ts'
import { cn } from '@/lib/cn.ts'

const HOLDING_ICON: Record<Holding, typeof KeyRound> = {
  device: CircleDot,
  backup: KeyRound,
  'split-share': Puzzle,
  passphrase: ShieldEllipsis,
  pin: Lock,
  config: FileKey2,
}

const HOLDING_LABEL: Record<Holding, string> = {
  device: 'The signing device',
  backup: 'A whole backup of the key',
  'split-share': 'One share of a split backup',
  passphrase: 'The passphrase',
  pin: "The device's PIN",
  config: 'A wallet configuration copy',
}

/**
 * Keys down the side, places across the top, and the arithmetic that matters at
 * the bottom of each column: how much of each wallet's threshold is inside that
 * one place. A column this paints red is a column the findings list has a
 * critical entry for, because both use the same evaluation.
 *
 * The diagram above it shows the shape. This shows the fraction, which a
 * diagram is bad at and which is the number people actually quote at each other.
 */
export function QuorumTable({ plan }: { plan: Plan }) {
  const map = useMemo(() => buildMap(createContext(plan)), [plan])
  const index = useMemo(() => indexPlan(plan), [plan])

  const cellFor = (keyId: string, locationId: string) =>
    map.cells.find((cell) => cell.keyId === keyId && cell.locationId === locationId)

  return (
    <>
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">
            Key material by location, with the quorum each location holds for every wallet
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface p-3 text-left align-bottom">
                <span className="eyebrow">Key</span>
              </th>
              {map.columns.map((column) => {
                const location = index.locations.get(column.locationId)
                if (!location) return null
                return (
                  <th
                    key={column.locationId}
                    scope="col"
                    className={cn(
                      'min-w-[7.5rem] border-b border-line p-3 text-left align-bottom',
                      column.concentratesQuorum && 'bg-critical/[0.07]'
                    )}
                  >
                    <span className="block text-[0.8125rem] font-semibold text-strong">
                      {location.label}
                    </span>
                    <span className="mt-0.5 block text-[0.6875rem] font-normal leading-tight text-faint">
                      {describeTravel(location.travelMinutes)}
                      {location.disasterGroup ? (
                        <>
                          <br />
                          {location.disasterGroup}
                        </>
                      ) : null}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {plan.keys.map((key) => (
              <tr key={key.id} className="border-b border-line">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface p-3 text-left text-[0.8125rem] font-medium text-strong"
                >
                  {key.label}
                  <span className="mono block text-[0.6875rem] font-normal text-faint">
                    {plan.wallets
                      .filter((wallet) => wallet.paths.some((path) => path.keyIds.includes(key.id)))
                      .map((wallet) => wallet.label)
                      .join(', ') || 'in no wallet'}
                  </span>
                </th>
                {map.columns.map((column) => {
                  const cell = cellFor(key.id, column.locationId)
                  return (
                    <td
                      key={column.locationId}
                      className={cn(
                        'p-3 align-middle',
                        column.concentratesQuorum && 'bg-critical/[0.04]'
                      )}
                    >
                      {cell ? (
                        <span className="flex flex-wrap gap-1.5">
                          {cell.holds.map((holding) => {
                            const Icon = HOLDING_ICON[holding]
                            return (
                              <span
                                key={holding}
                                title={HOLDING_LABEL[holding]}
                                className="inline-flex size-6 items-center justify-center rounded-full border border-line-strong bg-raised text-accent"
                              >
                                <Icon className="size-3.5" aria-hidden />
                                <span className="sr-only">{HOLDING_LABEL[holding]}</span>
                              </span>
                            )
                          })}
                        </span>
                      ) : (
                        <span className="text-faint" aria-label="nothing here">
                          &middot;
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>

          <tfoot className="border-t-2 border-line-strong">
            <tr className="bg-sunken">
              <th
                scope="col"
                colSpan={map.columns.length + 1}
                className="sticky left-0 px-3 pb-1 pt-2.5 text-left"
              >
                <span className="eyebrow">What each place is enough for</span>
              </th>
            </tr>
            {plan.wallets.map((wallet) => (
              <tr key={wallet.id} className="border-t border-line bg-sunken">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-sunken p-3 text-left text-[0.8125rem] font-medium text-strong"
                >
                  {wallet.label}
                  <span className="mono block text-[0.6875rem] font-normal text-faint">
                    {TIER[wallet.tier].toLowerCase()}
                    {wallet.decoy ? ' · decoy' : ''}
                  </span>
                </th>
                {map.columns.map((column) => {
                  const quorum = column.quorum.find((entry) => entry.walletId === wallet.id)
                  if (!quorum || quorum.threshold === 0) {
                    return (
                      <td key={column.locationId} className="bg-sunken p-3 text-faint">
                        &middot;
                      </td>
                    )
                  }
                  const exposed = quorum.spendable && !wallet.decoy
                  return (
                    <td
                      key={column.locationId}
                      className={cn(
                        'bg-sunken p-3',
                        column.concentratesQuorum && 'bg-critical/[0.07]'
                      )}
                    >
                      <span
                        className={cn(
                          'mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem]',
                          // The one thing on this table that should shout gets
                          // a solid ground rather than a tint, which also puts
                          // it well clear of the contrast floor in both themes.
                          exposed
                            ? 'border-transparent bg-critical font-semibold text-canvas'
                            : quorum.present > 0
                              ? 'border-line-strong text-body'
                              : 'border-transparent text-faint'
                        )}
                        title={
                          exposed
                            ? `${wallet.label} can be spent from this location alone`
                            : `${quorum.present} of the ${quorum.threshold} keys needed`
                        }
                      >
                        {quorum.present}/{quorum.threshold}
                        {exposed ? ' spendable' : ''}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tfoot>
        </table>
      </Panel>

      <div className={cn('mt-4 grid gap-4', map.unplacedKeyIds.length > 0 && 'lg:grid-cols-2')}>
        <Panel className="p-4">
          <p className="eyebrow mb-2">What the symbols mean</p>
          <ul className="grid gap-1.5 text-xs text-muted sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(HOLDING_LABEL) as Holding[]).map((holding) => {
              const Icon = HOLDING_ICON[holding]
              return (
                <li key={holding} className="flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full border border-line-strong text-accent">
                    <Icon className="size-3" aria-hidden />
                  </span>
                  {HOLDING_LABEL[holding]}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-faint">
            A column shaded red holds enough, on its own, to spend a wallet that is not a decoy. The
            fraction under each wallet is how many of that wallet&apos;s keys have material in that
            one place, against the lowest threshold it can be spent with today.
          </p>
        </Panel>

        {map.unplacedKeyIds.length > 0 ? (
          <Panel className="p-4">
            <p className="eyebrow mb-2">Not on the map</p>
            <p className="text-sm text-muted">
              {map.unplacedKeyIds.map((keyId) => index.keys.get(keyId)?.label ?? keyId).join(', ')}{' '}
              {map.unplacedKeyIds.length === 1 ? 'has' : 'have'} material with no recorded place, so{' '}
              {map.unplacedKeyIds.length === 1 ? 'it is' : 'they are'} excluded from every column
              above. The location analysis is optimistic by exactly that much.
            </p>
          </Panel>
        ) : null}
      </div>
    </>
  )
}
