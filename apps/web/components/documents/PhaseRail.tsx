'use client'

import { useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { PHASE_TITLE, type Runbook, type RunbookPhase, type RunbookStep } from '@outlive/core'
import { cn } from '@/lib/cn.ts'

export const phaseAnchor = (phase: RunbookPhase) => `phase-${phase}`
export const stepAnchor = (step: RunbookStep) => `step-${step.id}`

/**
 * Where the build is, by phase, held at the top of the page while you scroll.
 *
 * A runbook is twenty-odd steps over eight phases and several weeks, and one
 * bar across all of it said how much and not which. "Keys generated, nothing
 * recorded yet" is the dangerous half-state this document exists to get
 * through quickly, and it is invisible in a single percentage. So each phase
 * is its own segment, one tick per step, with the gates outlined, and the
 * phase being read is marked.
 *
 * It also names the next thing not done, because a document ticked over weeks
 * is reopened far more often than it is read from the top.
 */
export function PhaseRail({
  runbook,
  done,
}: {
  runbook: Runbook
  done: (step: RunbookStep) => boolean
}) {
  const [reading, setReading] = useState<RunbookPhase | null>(null)

  // The phase whose heading most recently crossed the top of the window.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const sections = runbook.phases
      .map((group) => document.getElementById(phaseAnchor(group.phase)))
      .filter((element): element is HTMLElement => element !== null)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setReading(visible[0].target.id.replace(/^phase-/, '') as RunbookPhase)
      },
      { rootMargin: '-140px 0px -55% 0px' }
    )
    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [runbook])

  const next = runbook.steps.find((step) => !done(step)) ?? null
  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })

  return (
    <nav
      aria-label="Phases"
      // Below the top bar rather than under its edge, and the width of the
      // column it sits over rather than wider.
      className="sticky top-[3.55rem] z-20 mb-6 rounded-[var(--radius-card)] border border-line bg-surface/90 px-3 py-3 shadow-[var(--shadow-panel)] backdrop-blur no-print"
    >
      <ol className="flex gap-1.5">
        {runbook.phases.map((group, position) => {
          const finished = group.steps.filter(done).length
          const complete = finished === group.steps.length
          const current = reading === group.phase
          return (
            <li key={group.phase} className="min-w-0" style={{ flex: `${group.steps.length} 1 0` }}>
              <button
                type="button"
                onClick={() => jump(phaseAnchor(group.phase))}
                aria-current={current ? 'step' : undefined}
                aria-label={`Phase ${position + 1}, ${PHASE_TITLE[group.phase]}: ${finished} of ${group.steps.length} done`}
                title={`${PHASE_TITLE[group.phase]}: ${finished} of ${group.steps.length} done`}
                className="group block w-full text-left"
              >
                <span className="flex h-2 gap-[2px]">
                  {group.steps.map((step) => (
                    <span
                      key={step.id}
                      className={cn(
                        'min-w-[3px] flex-1 rounded-[2px] transition-colors duration-300',
                        done(step)
                          ? 'bg-ok'
                          : step.gate
                            ? 'bg-accent/15 ring-1 ring-inset ring-accent/60'
                            : 'bg-line-strong/70 group-hover:bg-line-strong'
                      )}
                    />
                  ))}
                </span>
                <span
                  className={cn(
                    'mt-1.5 block truncate text-[0.6875rem] leading-tight transition-colors',
                    current ? 'font-medium text-strong' : complete ? 'text-muted' : 'text-faint',
                    'max-md:hidden'
                  )}
                >
                  {PHASE_TITLE[group.phase]}
                </span>
                <span
                  className={cn(
                    'mono mt-1 block text-center text-[0.625rem] md:hidden',
                    current ? 'text-strong' : 'text-faint'
                  )}
                >
                  {position + 1}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-2 text-xs">
        {next ? (
          <button
            type="button"
            onClick={() => jump(stepAnchor(next))}
            className="flex min-w-0 items-center gap-1.5 text-left text-muted hover:text-strong"
          >
            <ArrowDown className="size-3 flex-none text-accent" aria-hidden />
            <span className="truncate">
              Next: <span className="text-body">{next.title}</span>
              {next.gate ? <span className="text-accent"> (a gate)</span> : null}
            </span>
          </button>
        ) : (
          <span className="text-muted">Every step is ticked. The maintenance dates are next.</span>
        )}
        <span className="flex flex-none items-center gap-3 text-[0.6875rem] text-faint">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-[2px] bg-ok" aria-hidden />
            done
          </span>
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-[2px] bg-accent/15 ring-1 ring-inset ring-accent/60"
              aria-hidden
            />
            gate
          </span>
        </span>
      </div>
    </nav>
  )
}
