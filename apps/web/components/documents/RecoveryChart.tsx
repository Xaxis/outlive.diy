'use client'

import { useMemo, useState } from 'react'
import { LockOpen, TriangleAlert, X } from 'lucide-react'
import { describeDuration, describeTolerance, type RecoveryRoute } from '@outlive/core'
import { cn } from '@/lib/cn.ts'

/**
 * Every recovery route against the time you said you could wait.
 *
 * The purpose page asks how long you could go without being able to move
 * coins, and the implication beside it names the single slowest route. That is
 * the right sentence and the wrong resolution: a tolerance of a month is met
 * or missed route by route, and whether one route is over it or six are is a
 * different plan. So each route is a bar on one scale, with the tolerance as a
 * line through all of them.
 *
 * The two kinds of time keep the colours the timeline inside each route uses:
 * waiting is imposed and travelling is work. A route with no recovery at all
 * has no bar, because a bar of any length would say it ends. It says so in
 * words and with a cross instead.
 *
 * Every figure is the same floor `timing.ts` computes, so a route whose timing
 * has unknowns is marked "at least" and its bar ends in a dashed edge rather
 * than a solid one.
 */

const DAY_MINUTES = 24 * 60

interface Row {
  route: RecoveryRoute
  waitDays: number
  travelDays: number
  /** The whole length on the scale, in days. Same-day travel counts as a fraction. */
  span: number
  floor: boolean
  over: boolean
}

export function RecoveryChart({
  routes,
  toleranceDays,
  onPick,
}: {
  routes: RecoveryRoute[]
  toleranceDays: number
  onPick: (scenarioId: string) => void
}) {
  const [hover, setHover] = useState<string | null>(null)

  const rows = useMemo<Row[]>(() => {
    const out = routes.map((route) => {
      const timing = route.timing
      if (!route.possible || !timing || !timing.possible) {
        return { route, waitDays: 0, travelDays: 0, span: 0, floor: false, over: false }
      }
      const waitDays = timing.steps
        .filter((step) => step.part === 'wait')
        .reduce((worst, step) => Math.max(worst, step.days), 0)
      const travelDays = Math.max(timing.days - waitDays, timing.travelMinutes / DAY_MINUTES)
      const span = waitDays + travelDays
      return {
        route,
        waitDays,
        travelDays,
        span,
        floor: timing.unknowns.length > 0,
        over: timing.days > toleranceDays,
      }
    })
    // Worst first: no route at all, then whatever somebody else can spend, then
    // the longest. The list underneath keeps the engine's order, which is the
    // order the events are named in; this is the order they should be read in.
    const rank = (row: Row) =>
      !row.route.possible ? 0 : row.route.exposedWalletIds.length > 0 ? 1 : 2
    return out.sort((a, b) => rank(a) - rank(b) || b.span - a.span)
  }, [routes, toleranceDays])

  const longest = Math.max(1, toleranceDays, ...rows.map((row) => row.span))
  const max = longest * 1.08
  const at = (days: number) => `${(days / max) * 100}%`
  const toleranceShown = toleranceDays > 0

  const ticks = useMemo(() => {
    const step = niceStep(max)
    const out: number[] = []
    for (let value = 0; value <= max; value += step) out.push(value)
    return out
  }, [max])

  const hovered = rows.find((row) => row.route.scenarioId === hover) ?? null
  const overCount = rows.filter((row) => row.over).length
  const noRoute = rows.filter((row) => !row.route.possible).length

  return (
    <figure className="card p-4 no-print">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium text-strong">How long each one takes</span>
        <span className="text-xs text-muted">
          {noRoute > 0 ? `${noRoute} with no route. ` : ''}
          {toleranceShown
            ? overCount === 0
              ? `None past ${describeTolerance(toleranceDays)}, which is what you said you could wait.`
              : `${overCount} past ${describeTolerance(toleranceDays)}, which is what you said you could wait.`
            : 'You said a recovery has to happen the same day.'}
        </span>
      </figcaption>

      <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-x-3 max-sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]">
        {/* The axis, above the bars so it is read before them. */}
        <span />
        <div className="relative mb-1 mt-4 h-4 text-[0.625rem] text-faint" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="mono absolute -translate-x-1/2 tabular-nums first:translate-x-0"
              style={{ left: at(tick) }}
            >
              {tick === 0 ? '0' : `${tick}d`}
            </span>
          ))}
          {toleranceShown ? (
            <span
              className={cn(
                'absolute -top-4 whitespace-nowrap rounded bg-surface px-1 text-[0.625rem] font-medium text-body',
                // Anchored by its right edge when the line is near the end of
                // the scale, or it runs off the chart on a narrow screen.
                toleranceDays / max > 0.6 ? '-translate-x-full' : '-translate-x-1/2'
              )}
              style={{ left: at(toleranceDays) }}
            >
              you: {describeTolerance(toleranceDays).replace(/^within /, '')}
            </span>
          ) : null}
        </div>

        {rows.map((row) => {
          const lit = hover === row.route.scenarioId
          const dim = hover !== null && !lit
          return (
            <button
              key={row.route.scenarioId}
              type="button"
              onClick={() => onPick(row.route.scenarioId)}
              onMouseEnter={() => setHover(row.route.scenarioId)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(row.route.scenarioId)}
              onBlur={() => setHover(null)}
              className={cn(
                'col-span-2 grid grid-cols-subgrid items-center rounded-[6px] py-[3px] text-left transition-[background-color,opacity]',
                lit && 'bg-[rgb(var(--tint)/0.05)]',
                dim && 'opacity-60'
              )}
              aria-label={`${row.route.title}: ${label(row)}`}
            >
              <span
                className={cn('truncate pl-1 text-[0.78rem]', lit ? 'text-strong' : 'text-body')}
              >
                {row.route.title}
              </span>
              <span className="relative block h-5">
                {/* Grid lines sit behind every row so the eye can run down a
                    column without an axis at the bottom as well. */}
                {ticks.slice(1).map((tick) => (
                  <span
                    key={tick}
                    aria-hidden
                    className="absolute inset-y-0 w-px bg-line"
                    style={{ left: at(tick) }}
                  />
                ))}
                {toleranceShown ? (
                  <span
                    aria-hidden
                    className="absolute -inset-y-[3px] w-0 border-l border-dashed border-strong/60"
                    style={{ left: at(toleranceDays) }}
                  />
                ) : null}
                {!row.route.possible ? (
                  <span className="absolute inset-y-0 left-0 flex items-center gap-1 whitespace-nowrap text-[0.6875rem] font-medium text-critical">
                    <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                    no route
                    {row.route.exposedWalletIds.length > 0 ? (
                      <>
                        <LockOpen className="ml-1.5 size-3" aria-hidden />
                        <span className="max-sm:hidden">and somebody else can spend</span>
                      </>
                    ) : null}
                  </span>
                ) : (
                  <span
                    className="absolute inset-y-[4px] left-0 flex items-center"
                    style={{ width: '100%' }}
                  >
                    <span
                      className="flex h-full overflow-hidden rounded-[3px]"
                      style={{ width: `max(4px, ${at(row.span)})` }}
                    >
                      {row.waitDays > 0 ? (
                        <span
                          className="recovery-bar h-full bg-medium/75"
                          style={{ width: `${(row.waitDays / Math.max(row.span, 1e-9)) * 100}%` }}
                        />
                      ) : null}
                      <span
                        className={cn(
                          'recovery-bar h-full flex-1 bg-accent/75',
                          row.floor && 'border-r-2 border-dashed border-strong'
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        'ml-1.5 flex flex-none items-center gap-1 whitespace-nowrap text-[0.6875rem]',
                        row.over ? 'font-medium text-medium' : 'text-faint'
                      )}
                    >
                      {row.route.exposedWalletIds.length > 0 ? (
                        <LockOpen className="size-3 text-critical" aria-hidden />
                      ) : null}
                      {row.over ? <TriangleAlert className="size-3" aria-hidden /> : null}
                      {short(row)}
                    </span>
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[0.6875rem] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-[2px] bg-medium/75" aria-hidden />
          waiting, which nothing shortens
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-[2px] bg-accent/75" aria-hidden />
          travelling
        </span>
        {toleranceShown ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0 border-l border-dashed border-strong/60" aria-hidden />
            what you said you could wait
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <LockOpen className="size-3 text-critical" aria-hidden />
          somebody else can spend first
        </span>
      </div>

      <p className="mt-2 min-h-[1.25rem] text-xs text-faint" aria-live="polite">
        {hovered
          ? `${hovered.route.title}: ${label(hovered)}. Click to open the route.`
          : 'Point at a route for what it says. Click one to open it below.'}
      </p>
    </figure>
  )
}

function short(row: Row): string {
  const timing = row.route.timing
  if (!timing) return ''
  const text = describeDuration(timing.days, timing.travelMinutes).replace(/^about /, '~')
  return row.floor ? `≥ ${text.replace(/^~/, '')}` : text
}

function label(row: Row): string {
  const route = row.route
  const exposed =
    route.exposedWalletIds.length > 0 ? 'somebody else can spend before you move; ' : ''
  if (!route.possible) return `${exposed}nothing recovers it`
  const timing = route.timing
  const time = timing ? describeDuration(timing.days, timing.travelMinutes) : 'no time recorded'
  return `${exposed}${row.floor ? 'at least ' : ''}${time}${row.over ? ', past what you said you could wait' : ''}`
}

/** A tick step a reader can count in: 1, 2 or 5 of some power of ten, or a week. */
function niceStep(max: number): number {
  const rough = max / 5
  if (rough <= 1) return 1
  if (rough > 4 && rough <= 8) return 7
  const power = 10 ** Math.floor(Math.log10(rough))
  const scaled = rough / power
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power
}
