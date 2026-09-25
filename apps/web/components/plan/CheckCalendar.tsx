'use client'

import { Check } from 'lucide-react'
import { indexPlan, today, type Plan, type Verification } from '@outlive/core'
import { useStore } from '@/lib/store.ts'
import { VERIFICATION_KIND } from '@/lib/describe.ts'
import { cn } from '@/lib/cn.ts'

/**
 * The year ahead, as the checks fall due.
 *
 * A list of checks with intervals says how often; it does not say that three
 * of them land in the same fortnight in March, or that one is already a year
 * late. Each check is a row on twelve months, marked where it next falls
 * due. Anything overdue or never done sits at the left edge in red, because
 * it is due now, and one click records it done today.
 */

const DAY = 86_400_000
const SPAN_DAYS = 365

function addDays(iso: string, days: number): Date {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY)
}

export function CheckCalendar({ plan }: { plan: Plan }) {
  const edit = useStore((state) => state.edit)
  if (plan.verifications.length === 0) return null

  const now = new Date(`${today()}T00:00:00Z`)
  const index = indexPlan(plan)
  const subject = (check: Verification): string => {
    const { type, id } = check.subject
    const found =
      type === 'key'
        ? index.keys.get(id)
        : type === 'wallet'
          ? index.wallets.get(id)
          : type === 'device'
            ? index.devices.get(id)
            : type === 'person'
              ? index.people.get(id)
              : type === 'location'
                ? index.locations.get(id)
                : null
    return found?.label ?? ''
  }

  const rows = plan.verifications
    .map((check) => {
      const due = check.lastVerifiedAt ? addDays(check.lastVerifiedAt, check.intervalDays) : now
      const days = Math.round((due.getTime() - now.getTime()) / DAY)
      return { check, days, overdue: days <= 0 }
    })
    .sort((a, b) => a.days - b.days)

  const months = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1))
    return {
      label: date.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
      at: Math.round((date.getTime() - now.getTime()) / DAY) / SPAN_DAYS,
    }
  }).filter((month) => month.at < 1)

  return (
    <div className="card p-4 no-print">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-strong">The year ahead</h2>
        <p className="text-xs text-muted">
          {rows.filter((row) => row.overdue).length} due now,{' '}
          {rows.filter((row) => !row.overdue && row.days <= 90).length} in the next three months
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 max-sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]">
        <span />
        <div className="relative h-4 text-[0.625rem] text-faint max-sm:invisible" aria-hidden>
          {months.map((month) => (
            <span
              key={month.label}
              className="absolute -translate-x-1/2"
              style={{ left: `${month.at * 100}%` }}
            >
              {month.label}
            </span>
          ))}
        </div>
        <span />
        {rows.map(({ check, days, overdue }) => (
          <div key={check.id} className="contents">
            <span
              className="min-w-0 truncate text-[0.8125rem] text-body"
              title={VERIFICATION_KIND[check.kind]}
            >
              {VERIFICATION_KIND[check.kind]}
              {subject(check) ? <span className="text-muted"> · {subject(check)}</span> : null}
            </span>
            <span className="relative block h-5" aria-hidden>
              <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
              {months.map((month) => (
                <span
                  key={month.label}
                  className="absolute inset-y-1 w-px bg-line"
                  style={{ left: `${month.at * 100}%` }}
                />
              ))}
              <span
                className={cn(
                  'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2',
                  overdue
                    ? 'border-critical bg-critical/40'
                    : days <= 90
                      ? 'border-medium bg-medium/40'
                      : 'border-ok bg-ok/30'
                )}
                style={{ left: `${Math.min(1, Math.max(0, days / SPAN_DAYS)) * 100}%` }}
              />
            </span>
            <span className="flex items-center justify-end gap-2 whitespace-nowrap text-[0.6875rem]">
              <span className={overdue ? 'font-medium text-critical' : 'text-muted'}>
                {check.lastVerifiedAt === null
                  ? 'never done'
                  : overdue
                    ? `${-days} days overdue`
                    : days > SPAN_DAYS
                      ? 'after this year'
                      : `in ${days} days`}
              </span>
              {overdue ? (
                <button
                  type="button"
                  aria-label={`${VERIFICATION_KIND[check.kind]}${subject(check) ? ` for ${subject(check)}` : ''}: done today`}
                  onClick={() =>
                    edit((draft) => {
                      const target = draft.verifications.find((entry) => entry.id === check.id)
                      if (target) target.lastVerifiedAt = today()
                    })
                  }
                  className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-body hover:border-accent hover:text-strong"
                >
                  <Check className="size-3" aria-hidden />
                  Done today
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
