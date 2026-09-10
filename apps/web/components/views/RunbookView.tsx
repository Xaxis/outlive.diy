'use client'

import { CheckCircle2, Circle, Printer, ShieldCheck } from 'lucide-react'
import { PHASE_PURPOSE, PHASE_TITLE, today, type RunbookStep } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { PrintHeader } from '@/components/shell/PrintHeader.tsx'
import { MEASURE, Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useRunbook } from '@/lib/analysis.ts'
import { planIsStarted } from '@/lib/describe.ts'
import { NothingYet } from '@/components/shell/NothingYet.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * Consecutive steps that say exactly the same thing, grouped so that the thing
 * is said once. The engine writes each step to stand on its own, which is right
 * for a document you tick over three weeks and wrong for three of them in a
 * row: a paragraph repeated is a paragraph skipped, and the next one that is
 * not a repeat gets skipped with it.
 */
function runsOf(steps: RunbookStep[]): RunbookStep[][] {
  const runs: RunbookStep[][] = []
  for (const step of steps) {
    const last = runs[runs.length - 1]
    if (last && last[0].detail === step.detail) last.push(step)
    else runs.push([step])
  }
  return runs
}

/**
 * The build runbook, with the state of it.
 *
 * Progress is stored in the plan rather than in the browser, because building
 * one of these takes weeks and involves travel, and "half done, and here is
 * which half" is a thing worth being able to save, print and hand over.
 */
export function RunbookView() {
  const plan = useActivePlan()
  const runbook = useRunbook(plan)
  const edit = useStore((state) => state.edit)

  if (!plan || !runbook) return null

  const done = (step: RunbookStep) => Boolean(plan.progress[step.id])
  const toggle = (step: RunbookStep) =>
    edit((draft) => {
      if (draft.progress[step.id]) delete draft.progress[step.id]
      else draft.progress[step.id] = today()
    })

  const completed = runbook.steps.filter(done).length
  const gatesDone = runbook.gates.filter(done).length

  if (!planIsStarted(plan) || runbook.steps.length === 0) {
    return (
      <div className={MEASURE.read}>
        <ViewHeader
          eyebrow="Documents"
          title="Build runbook"
          question="Ordered steps from nothing to the plan you designed."
        />
        <NothingYet what="there are no steps to order." />
      </div>
    )
  }

  return (
    <div className={MEASURE.read}>
      <PrintHeader />

      <ViewHeader
        eyebrow="Documents"
        title="Build runbook"
        question="Ordered steps from nothing to the plan you designed. The gates are the ones everybody skips."
        actions={
          <Button
            variant="default"
            onClick={() => window.print()}
            icon={<Printer className="size-3.5" aria-hidden />}
          >
            Print
          </Button>
        }
      />

      <Panel className="mb-6 p-4 print-block">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-strong">
              {completed} of {runbook.steps.length} steps done
            </p>
            <p className="text-xs text-faint">
              {gatesDone} of {runbook.gates.length} verification gates passed
            </p>
          </div>
          <div className="mono text-xs text-faint no-print">{plan.name}</div>
        </div>
        <div className="no-print mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${Math.round((completed / runbook.steps.length) * 100)}%` }}
          />
        </div>
      </Panel>

      {runbook.gates.length > 0 ? (
        <Panel className="mb-6 border-accent/30 p-4 print-block">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent" aria-hidden />
            <h2 className="text-sm font-semibold text-strong">The gates</h2>
          </div>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            These produce evidence rather than progress. Nothing after them is safe until they pass,
            and each one converts the largest assumption in the plan into a fact.
          </p>
          <ul className="space-y-1.5">
            {runbook.gates.map((gate) => (
              <li key={gate.id} className="flex items-start gap-2 text-[0.8125rem]">
                {done(gate) ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 flex-none text-ok" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 size-3.5 flex-none text-faint" aria-hidden />
                )}
                <span className={cn(done(gate) ? 'text-faint line-through' : 'text-body')}>
                  {gate.title}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="space-y-8">
        {runbook.phases.map((group, phaseIndex) => (
          <section key={group.phase}>
            <header className="mb-3 border-b border-line pb-2">
              <p className="eyebrow">Phase {phaseIndex + 1}</p>
              <h2 className="text-base font-semibold text-strong">{PHASE_TITLE[group.phase]}</h2>
              <p className="mt-0.5 text-sm text-muted">{PHASE_PURPOSE[group.phase]}</p>
            </header>
            <ol className="space-y-2">
              {runsOf(group.steps).map((run) => (
                <li key={run[0].id}>
                  {/* One instruction, then the things to do it to. Three keys
                      generated the same way produced three copies of the same
                      paragraph, and ten keys produce ten, which is how a reader
                      learns that the paragraphs are worth skipping. */}
                  {run.length > 1 ? (
                    <p className="mb-2 max-w-[62ch] text-[0.8125rem] leading-relaxed text-muted print-block">
                      {run[0].detail}
                    </p>
                  ) : null}
                  <ol className="space-y-2">
                    {run.map((step) => (
                      <li key={step.id}>
                        <div
                          className={cn(
                            'card flex gap-3 p-3.5 print-block',
                            step.gate && 'border-accent/40',
                            done(step) && 'opacity-60'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggle(step)}
                            aria-pressed={done(step)}
                            aria-label={done(step) ? 'Mark not done' : 'Mark done'}
                            className="no-print mt-[0.15rem] flex-none self-start"
                          >
                            {done(step) ? (
                              <CheckCircle2 className="size-4 text-ok" aria-hidden />
                            ) : (
                              <Circle
                                className="size-4 text-faint transition-colors hover:text-accent"
                                aria-hidden
                              />
                            )}
                          </button>
                          <span className="print-only mt-0.5 flex-none self-start">☐</span>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-baseline gap-2 text-[0.875rem] font-medium text-strong">
                              {step.title}
                              {step.gate ? (
                                <span className="chip border-accent/50 text-accent">gate</span>
                              ) : null}
                              {done(step) ? (
                                <span className="mono text-[0.6875rem] font-normal text-faint">
                                  {plan.progress[step.id]}
                                </span>
                              ) : null}
                            </p>
                            {run.length > 1 ? null : (
                              <p className="mt-1 max-w-[62ch] text-[0.8125rem] leading-relaxed text-muted">
                                {step.detail}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
