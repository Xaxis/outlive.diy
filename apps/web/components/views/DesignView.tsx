'use client'

import { useDeferredValue } from 'react'
import type { PresetStep } from '@outlive/core'
import { ArrowLeft, ArrowRight, Check, Circle } from 'lucide-react'
import { MEASURE, ViewHeader } from '@/components/ui/Surface.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ProfileEditor } from '@/components/plan/ProfileEditor.tsx'
import { EntityWorkbench } from '@/components/plan/EntityWorkbench.tsx'
import { StepEffect } from '@/components/plan/StepEffect.tsx'
import { StepVisual } from '@/components/plan/StepVisual.tsx'
import { CheckCalendar } from '@/components/plan/CheckCalendar.tsx'
import { DeviceShelf } from '@/components/plan/DeviceShelf.tsx'
import { StepPresets } from '@/components/plan/StepPresets.tsx'
import { entitiesOf, useActivePlan, useStore } from '@/lib/store.ts'
import { useReport } from '@/lib/analysis.ts'
import { useRoute } from '@/lib/router.ts'
import { SECTIONS } from '@/lib/sections.ts'
import { cn } from '@/lib/cn.ts'

/**
 * Where a plan is described, in the order that makes the answers mean
 * something.
 *
 * This was two screens. One was a tabbed editor and the other was a guided
 * route through the same seven editors in the same order, each with a reason
 * written before the fields and the consequence written after them. Two doors
 * onto one room, two sets of section blurbs that had already drifted apart, and
 * a reader whose first decision was which of them to use.
 *
 * The guidance is the part worth keeping, so it is not a mode any more. Every
 * section says why it exists before you fill it in and what your answers just
 * did to the analysis afterwards, and the steps across the top are both a
 * position in an order and a way out of it. A route that only collects answers
 * teaches nothing, and the person walking it has no way to tell a good answer
 * from a careless one until the very end.
 */
/** Which presets belong to which step. */
const STEP_OF: Record<string, PresetStep> = {
  profile: 'profile',
  locations: 'locations',
  people: 'people',
  devices: 'devices',
  keys: 'keys',
  wallets: 'wallets',
  checks: 'checks',
}

export function DesignView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  // The pictures follow the typing rather than holding it up. A field commits
  // on every keystroke, and redrawing the whole plan before the next letter
  // can land is a field that lags on a slow phone.
  const settled = useDeferredValue(plan)
  const settledReport = useReport(settled)
  const select = useStore((state) => state.select)
  const [route, navigate] = useRoute()

  const index = Math.max(
    0,
    SECTIONS.findIndex((entry) => entry.id === route.section)
  )
  const section = SECTIONS[index]

  if (!plan || !report) return null

  const go = (next: number) => {
    // Leaving a step with one thing open would land on the next one with an
    // inspector already showing something that is not on it.
    select(null)
    navigate({
      view: 'design',
      section: SECTIONS[Math.min(SECTIONS.length - 1, Math.max(0, next))].id,
    })
  }

  return (
    <div className={MEASURE.wide}>
      <ViewHeader
        eyebrow={`Step ${index + 1} of ${SECTIONS.length}`}
        title={section.label}
        question={section.purpose}
      />

      {/* One line that scrolls on a phone, rather than three rows with a
          connector dangling from the end of each. Adding lives under the list
          it adds to, once, rather than here as well. */}
      <nav aria-label="Steps" className="-mx-4 mb-6 overflow-x-auto px-4 no-print sm:mx-0 sm:px-0">
        <ol className="flex w-max items-center gap-1 sm:w-auto sm:flex-wrap">
          {SECTIONS.map((entry, position) => {
            const done = entry.done(plan)
            const current = position === index
            const count = entry.kind ? entitiesOf(plan, entry.kind).length : 0
            return (
              <li key={entry.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => go(position)}
                  ref={
                    current
                      ? (node) => node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
                      : undefined
                  }
                  aria-current={current ? 'step' : undefined}
                  title={entry.optional ? 'Optional' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                    current
                      ? 'border-accent bg-accent/10 font-medium text-strong'
                      : done
                        ? 'border-line-strong text-muted hover:text-strong'
                        : 'border-line text-faint hover:text-muted'
                  )}
                >
                  {/* Answered or not, rather than a position. The order is the
                      row itself and the heading above it already says which of
                      the seven this is; a number here as well sat beside the
                      count and made "2 Places 3" of it. */}
                  {done ? (
                    <Check className="size-3 flex-none text-ok" aria-hidden />
                  ) : (
                    <Circle className="size-3 flex-none text-faint" aria-hidden />
                  )}
                  {entry.label}
                  {count > 0 ? (
                    // The faint step of the ramp does not clear 4.5:1 against
                    // the tint a current step sits on.
                    <span
                      className={cn('mono text-[0.6875rem]', current ? 'text-muted' : 'text-faint')}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
                {position < SECTIONS.length - 1 ? (
                  <span className="mx-0.5 h-px w-3 bg-line" aria-hidden />
                ) : null}
              </li>
            )
          })}
        </ol>
      </nav>

      <StepPresets plan={plan} step={STEP_OF[section.id]} />

      {section.kind === null ? (
        <ProfileEditor plan={plan} />
      ) : (
        <>
          {/* Where things are, as a grid you click, beside the picture it
              changes. Side by side where there is room, so a click and its
              consequence are in view together. */}
          {section.kind === 'verification' ? (
            // Checks are about when, not where: the year ahead, not the plan
            // drawn.
            <div className="mb-4">
              <CheckCalendar plan={settled ?? plan} />
            </div>
          ) : section.kind === 'device' ? (
            // Devices are about who made them more than where they are, so
            // this step gets the maker count instead of the grid.
            <DeviceShelf plan={settled ?? plan} report={settledReport ?? report} />
          ) : (
            <StepVisual plan={settled ?? plan} preferDrawing={section.kind === 'wallet'} />
          )}
          <EntityWorkbench
            plan={plan}
            report={report}
            kind={section.kind}
            singular={section.singular}
            plural={section.label}
          />
          <StepEffect plan={settled ?? plan} report={settledReport ?? report} kind={section.kind} />
        </>
      )}

      {/* One row at every width: back on the left, forward on the right, and
          forward says where it goes. */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4 no-print">
        {index > 0 ? (
          <Button onClick={() => go(index - 1)} icon={<ArrowLeft className="size-4" aria-hidden />}>
            {SECTIONS[index - 1].label}
          </Button>
        ) : (
          <span />
        )}
        <span className="hidden text-center text-xs text-faint md:block">
          Saved as you type. Take the steps in any order.
        </span>
        {index < SECTIONS.length - 1 ? (
          <Button variant="primary" onClick={() => go(index + 1)}>
            Next: {SECTIONS[index + 1].label}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="primary" onClick={() => navigate({ view: 'findings', section: null })}>
            Read the findings
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}
