'use client'

import { KeyRound, MapPin, TriangleAlert } from 'lucide-react'
import type { AnalysisReport, Plan } from '@outlive/core'
import { DEVICE_ICON } from '@/components/plan/DeviceInspector.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { useStore } from '@/lib/store.ts'
import { DEVICE_KIND } from '@/lib/describe.ts'
import { describeDevice } from '@/lib/devices.ts'
import { cn } from '@/lib/cn.ts'

/** The rules that are about who made the devices, rather than where they are. */
const MAKER_RULES = new Set(['R001', 'R002', 'C003', 'R005', 'S012'])

/**
 * Every device, as the objects on a shelf, and the question the devices step
 * exists to answer: how many makers does a quorum depend on.
 *
 * A list of labels said nothing about that. The bar under the shelf is one
 * segment per maker, as wide as its share of the devices, and the findings
 * beside it are the engine's own verdict on it, so a reader sees "two of my
 * three signers are one maker" and why that matters in one place.
 */
export function DeviceShelf({ plan, report }: { plan: Plan; report: AnalysisReport }) {
  const select = useStore((state) => state.select)
  const selection = useStore((state) => state.selection)
  if (plan.devices.length === 0) return null

  const makers = new Map<string, number>()
  for (const device of plan.devices) {
    const name = device.vendor?.trim() || 'Maker not recorded'
    makers.set(name, (makers.get(name) ?? 0) + 1)
  }
  const shares = [...makers.entries()].sort((a, b) => b[1] - a[1])
  const findings = report.findings.filter((finding) => MAKER_RULES.has(finding.rule))
  const place = (id: string | null) => plan.locations.find((entry) => entry.id === id)?.label

  return (
    <div className="card mb-4 p-4 no-print">
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {plan.devices.map((device) => {
          const Icon = DEVICE_ICON[device.kind]
          const keys = plan.keys.filter((key) => key.deviceId === device.id)
          const selected = selection?.type === 'device' && selection.id === device.id
          return (
            <li key={device.id}>
              <button
                type="button"
                onClick={() => select({ type: 'device', id: device.id })}
                aria-pressed={selected}
                className={cn(
                  'flex h-full w-full items-start gap-3 rounded-[var(--radius-control)] border p-3 text-left transition-colors',
                  selected
                    ? 'border-accent bg-accent/[0.07]'
                    : 'border-line hover:border-line-strong'
                )}
              >
                <span className="flex size-9 flex-none items-center justify-center rounded-[8px] border border-line-strong bg-sunken">
                  <Icon className="size-4 text-accent" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-strong">
                    {device.label}
                  </span>
                  <span className="block truncate text-[0.6875rem] text-faint">
                    {describeDevice(device) === device.label
                      ? DEVICE_KIND[device.kind]
                      : describeDevice(device)}
                    {device.airGapped ? ' · air-gapped' : ''}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {keys.length === 0 ? (
                      <span className="text-[0.6875rem] text-faint">holds no key</span>
                    ) : (
                      keys.map((key) => (
                        <span
                          key={key.id}
                          className="flex items-center gap-1 rounded-full border border-line px-1.5 text-[0.6875rem] text-muted"
                        >
                          <KeyRound className="size-2.5 text-accent" aria-hidden />
                          {key.label}
                          {key.deviceLocationId ? (
                            <>
                              <MapPin className="size-2.5 text-faint" aria-hidden />
                              {place(key.deviceLocationId)}
                            </>
                          ) : null}
                        </span>
                      ))
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 border-t border-line pt-3">
        <p className="label mb-1.5">Makers</p>
        <div className="flex h-6 gap-[2px] overflow-hidden rounded-[6px]" aria-hidden>
          {shares.map(([name, count], index) => (
            <span
              key={name}
              className={cn(
                'flex min-w-0 items-center truncate px-2 text-[0.6875rem] font-medium',
                name === 'Maker not recorded'
                  ? 'border border-dashed border-line-strong text-faint'
                  : index % 2 === 0
                    ? 'bg-accent/25 text-strong'
                    : 'bg-accent/12 text-strong'
              )}
              style={{ flex: `${count} 1 0` }}
              title={`${name}: ${count}`}
            >
              {name} ×{count}
            </span>
          ))}
        </div>
        <p className="sr-only">{shares.map(([name, count]) => `${name}: ${count}`).join(', ')}.</p>
        {findings.length > 0 ? (
          <ul className="mt-2.5 space-y-1">
            {findings.map((finding) => (
              <li key={finding.id} className="flex items-start gap-2 text-[0.8125rem] text-body">
                <SeverityDot severity={finding.severity} className="mt-[0.45rem]" />
                {finding.title}
              </li>
            ))}
          </ul>
        ) : shares.length > 1 || plan.devices.length < 2 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            {plan.devices.length < 2
              ? 'One device, one maker.'
              : 'No quorum depends on a single maker.'}
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <TriangleAlert className="size-3.5 text-medium" aria-hidden />
            Every device is from one maker.
          </p>
        )}
      </div>
    </div>
  )
}
