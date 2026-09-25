'use client'

import { TriangleAlert } from 'lucide-react'
import type { AnalysisReport, Plan } from '@outlive/core'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { cn } from '@/lib/cn.ts'

/** The rules that are about who made the devices, rather than where they are. */
const MAKER_RULES = new Set(['R001', 'R002', 'C003', 'R005', 'S012'])

/**
 * The question the devices step exists to answer: how many makers does a
 * quorum depend on. The devices themselves are listed like every other
 * step's things, beside the form that edits them.
 *
 * A list of labels said nothing about that. The bar under the shelf is one
 * segment per maker, as wide as its share of the devices, and the findings
 * beside it are the engine's own verdict on it, so a reader sees "two of my
 * three signers are one maker" and why that matters in one place.
 */
export function DeviceShelf({ plan, report }: { plan: Plan; report: AnalysisReport }) {
  if (plan.devices.length === 0) return null

  const makers = new Map<string, number>()
  for (const device of plan.devices) {
    const name = device.vendor?.trim() || 'Maker not recorded'
    makers.set(name, (makers.get(name) ?? 0) + 1)
  }
  const shares = [...makers.entries()].sort((a, b) => b[1] - a[1])
  const findings = report.findings.filter((finding) => MAKER_RULES.has(finding.rule))

  return (
    <div className="card mb-4 p-4 no-print">
      <div>
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
