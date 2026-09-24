'use client'

import { CircleDot, FileText, KeyRound, User } from 'lucide-react'
import { createBackup, createConfigBackup, createDevice, type Plan } from '@outlive/core'
import { useStore } from '@/lib/store.ts'
import { useReport } from '@/lib/analysis.ts'
import { SeverityBar } from '@/components/ui/Severity.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * What sits where, for the whole plan, edited by clicking.
 *
 * The inspectors edit one thing at a time, which is right for its details and
 * slow for its place: moving three backups was three items opened, three
 * dropdowns found, three places picked. Where things are is the single
 * decision the analysis cares most about, so it gets one grid: a row per key,
 * a column per place, and a click moves or adds the thing. The same grid the
 * builder uses, on the real plan.
 */
export function PlacementGrid({ plan }: { plan: Plan }) {
  const edit = useStore((state) => state.edit)
  const report = useReport(plan)
  if (plan.locations.length === 0 || plan.keys.length === 0) return null

  const multisig = plan.wallets.filter((wallet) =>
    wallet.paths.some((path) => path.keyIds.length > 1)
  )
  const successors = plan.people.filter(
    (person) => person.role === 'successor' || person.role === 'executor'
  )

  return (
    <div className="card p-4 no-print">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-strong">What goes where</h2>
        {/* The consequence of a click, beside the click. */}
        {report ? (
          <div aria-live="polite" className="w-full">
            <SeverityBar counts={report.counts} />
          </div>
        ) : null}
        <p className="flex flex-wrap gap-x-3 text-[0.6875rem] text-faint">
          <span className="flex items-center gap-1">
            <CircleDot className="size-3" aria-hidden /> device
          </span>
          <span className="flex items-center gap-1">
            <KeyRound className="size-3" aria-hidden /> backup
          </span>
          {multisig.length > 0 ? (
            <span className="flex items-center gap-1">
              <FileText className="size-3" aria-hidden /> descriptor
            </span>
          ) : null}
          {successors.length > 0 ? (
            <span className="flex items-center gap-1">
              <User className="size-3" aria-hidden /> opens after you
            </span>
          ) : null}
        </p>
      </div>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full border-collapse text-xs" aria-label="What goes where">
          <thead>
            <tr>
              <th className="sr-only">Item</th>
              {plan.locations.map((location) => (
                <th
                  key={location.id}
                  scope="col"
                  title={location.label}
                  className="max-w-[7rem] truncate px-1 pb-1.5 text-center text-[0.6875rem] font-medium text-muted"
                >
                  {location.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.keys.map((key) => (
              <tr key={key.id} className="border-t border-line">
                <th
                  scope="row"
                  className="whitespace-nowrap py-1.5 pr-3 text-left font-medium text-body"
                >
                  {key.label}
                </th>
                {key.heldBy ? (
                  <td colSpan={plan.locations.length} className="py-1.5 text-center text-faint">
                    held by somebody else
                  </td>
                ) : (
                  plan.locations.map((location) => {
                    const device = key.deviceLocationId === location.id && key.deviceId !== null
                    const backup = key.backups.some((entry) => entry.locationId === location.id)
                    return (
                      <td key={location.id} className="px-1 py-1.5">
                        <span className="flex justify-center gap-1">
                          <Cell
                            on={device}
                            label={`${key.label} device at ${location.label}`}
                            onClick={() =>
                              edit((draft) => {
                                const target = draft.keys.find((entry) => entry.id === key.id)
                                if (!target) return
                                if (device) {
                                  target.deviceLocationId = null
                                  return
                                }
                                if (!target.deviceId) {
                                  const created = createDevice({
                                    label: `Signer ${key.label.replace(/^Key /, '')}`,
                                  })
                                  draft.devices.push(created)
                                  target.deviceId = created.id
                                }
                                target.deviceLocationId = location.id
                              })
                            }
                          >
                            <CircleDot className="size-3.5" aria-hidden />
                          </Cell>
                          <Cell
                            on={backup}
                            label={`${key.label} backup at ${location.label}`}
                            onClick={() =>
                              edit((draft) => {
                                const target = draft.keys.find((entry) => entry.id === key.id)
                                if (!target) return
                                if (backup) {
                                  target.backups = target.backups.filter(
                                    (entry) => entry.locationId !== location.id
                                  )
                                  return
                                }
                                // A key with one backup nowhere gets it placed,
                                // rather than a second one added beside it.
                                const unplaced = target.backups.find((entry) => !entry.locationId)
                                if (unplaced) unplaced.locationId = location.id
                                else
                                  target.backups.push(
                                    createBackup({
                                      label: target.backups.length
                                        ? 'Steel plate 2'
                                        : 'Steel plate',
                                      medium: 'steel',
                                      locationId: location.id,
                                    })
                                  )
                              })
                            }
                          >
                            <KeyRound className="size-3.5" aria-hidden />
                          </Cell>
                        </span>
                      </td>
                    )
                  })
                )}
              </tr>
            ))}
            {multisig.map((wallet) => (
              <tr key={wallet.id} className="border-t border-line">
                <th
                  scope="row"
                  className="whitespace-nowrap py-1.5 pr-3 text-left font-medium text-body"
                >
                  {wallet.label} descriptor
                </th>
                {plan.locations.map((location) => {
                  const on = wallet.configBackups.some((entry) => entry.locationId === location.id)
                  return (
                    <td key={location.id} className="px-1 py-1.5">
                      <span className="flex justify-center">
                        <Cell
                          on={on}
                          label={`${wallet.label} descriptor at ${location.label}`}
                          onClick={() =>
                            edit((draft) => {
                              const target = draft.wallets.find((entry) => entry.id === wallet.id)
                              if (!target) return
                              if (on)
                                target.configBackups = target.configBackups.filter(
                                  (entry) => entry.locationId !== location.id
                                )
                              else
                                target.configBackups.push(
                                  createConfigBackup({
                                    label: `Descriptor at ${location.label}`,
                                    locationId: location.id,
                                  })
                                )
                            })
                          }
                        >
                          <FileText className="size-3.5" aria-hidden />
                        </Cell>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
            {successors.map((person) => (
              <tr key={person.id} className="border-t border-line">
                <th
                  scope="row"
                  className="whitespace-nowrap py-1.5 pr-3 text-left font-medium text-body"
                >
                  {person.label} opens
                </th>
                {plan.locations.map((location) => {
                  const on = location.access.some((access) => access.personId === person.id)
                  return (
                    <td key={location.id} className="px-1 py-1.5">
                      <span className="flex justify-center">
                        <Cell
                          on={on}
                          label={`${person.label} can open ${location.label}`}
                          onClick={() =>
                            edit((draft) => {
                              const target = draft.locations.find(
                                (entry) => entry.id === location.id
                              )
                              if (!target) return
                              if (on)
                                target.access = target.access.filter(
                                  (access) => access.personId !== person.id
                                )
                              else
                                target.access.push({
                                  personId: person.id,
                                  condition: 'after-death',
                                  delayDays: 0,
                                })
                            })
                          }
                        >
                          <User className="size-3.5" aria-hidden />
                        </Cell>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Cell({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-[6px] border transition-colors',
        on
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-line text-faint opacity-50 hover:border-line-strong hover:opacity-100'
      )}
    >
      {children}
    </button>
  )
}
