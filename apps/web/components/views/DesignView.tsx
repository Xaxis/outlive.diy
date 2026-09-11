'use client'

import { ArrowLeft, ArrowRight, Check, Circle, Plus } from 'lucide-react'
import { MEASURE, ViewHeader } from '@/components/ui/Surface.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ProfileEditor } from '@/components/plan/ProfileEditor.tsx'
import { EntityWorkbench } from '@/components/plan/EntityWorkbench.tsx'
import { StepEffect } from '@/components/plan/StepEffect.tsx'
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
export function DesignView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const select = useStore((state) => state.select)
  const addEntity = useStore((state) => state.addEntity)
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 no-print">
        <ol className="flex flex-wrap items-center gap-1">
          {SECTIONS.map((entry, position) => {
            const done = entry.done(plan)
            const current = position === index
            const count = entry.kind ? entitiesOf(plan, entry.kind).length : 0
            return (
              <li key={entry.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => go(position)}
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

        {/* The add button belongs beside the steps, next to the list it adds
            to, rather than floating at the far edge of the header. */}
        {section.kind ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="size-3.5" aria-hidden />}
            onClick={() => {
              const id = addEntity(section.kind!)
              if (id) select({ type: section.kind!, id })
            }}
          >
            Add {section.singular.toLowerCase()}
          </Button>
        ) : null}
      </div>

      {section.kind === null ? (
        <ProfileEditor plan={plan} />
      ) : (
        <>
          <EntityWorkbench
            plan={plan}
            report={report}
            kind={section.kind}
            singular={section.singular}
            plural={section.label}
          />
          <StepEffect plan={plan} report={report} kind={section.kind} />
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 no-print">
        <Button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          icon={<ArrowLeft className="size-4" aria-hidden />}
        >
          Back
        </Button>
        <span className="text-xs text-faint">
          Everything is saved as you type, and these can be taken in any order.
        </span>
        {index < SECTIONS.length - 1 ? (
          <Button variant="primary" onClick={() => go(index + 1)}>
            Next
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
