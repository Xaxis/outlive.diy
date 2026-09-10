'use client'

import { useMemo } from 'react'
import { ArrowRight, GitFork, Minus, Plus } from 'lucide-react'
import {
  analyze,
  baseWorld,
  buildGraph,
  compareReports,
  comparePlans,
  summariseDelta,
  type Finding,
} from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { MEASURE, Callout, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { Field, Select } from '@/components/ui/Field.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { useActivePlan, useComparePlan, useStore } from '@/lib/store.ts'

/**
 * Comparing two plans.
 *
 * The useful question is never "is this plan good", which has no answer, but
 * "does moving Key B to the other city close more than it opens". This answers
 * exactly that, by matching findings between the two runs.
 */
export function CompareView() {
  const plan = useActivePlan()
  const other = useComparePlan()
  const plans = useStore((state) => state.plans)
  const setCompare = useStore((state) => state.setCompare)
  const forkAsDraft = useStore((state) => state.forkAsDraft)

  const delta = useMemo(() => {
    if (!plan || !other) return null
    return compareReports(
      analyze(other, { includeScenarios: false }),
      analyze(plan, { includeScenarios: false })
    )
  }, [plan, other])

  const changes = useMemo(() => (plan && other ? comparePlans(other, plan) : []), [plan, other])

  // The two shapes, beside each other. A list of opened and closed findings
  // says what the change cost and what it bought; it does not show what was
  // actually moved, and that is the thing the reader is holding in their head.
  const shapes = useMemo(() => {
    if (!plan || !other) return null
    return {
      before: buildGraph(other, baseWorld(other), { includePeople: false }),
      after: buildGraph(plan, baseWorld(plan), { includePeople: false }),
    }
  }, [plan, other])

  /**
   * When a change closes nothing, the useful next sentence is not "nothing
   * happened". It is which findings about the thing you just changed are still
   * standing, because that is almost always the answer: the problem was
   * somewhere else all along.
   *
   * Matched against the baseline's copy of each finding, not this plan's. A
   * finding often stops naming the object you moved precisely because you moved
   * it, and that is the case worth explaining rather than the one to miss.
   */
  const stillStanding = useMemo(() => {
    if (!delta) return []
    if (delta.resolved.length > 0 || delta.introduced.length > 0) return []
    const touched = new Set(changes.map((change) => change.id))
    if (touched.size === 0) return []
    return delta.unchanged.filter((finding) =>
      finding.subjects.some((subject) => touched.has(subject.id))
    )
  }, [delta, changes])

  if (!plan) return null

  return (
    <div className={MEASURE.wide}>
      <ViewHeader
        eyebrow="More"
        title="Compare plans"
        question="Which findings a change closes, and which it opens. That trade is the decision; the individual findings are not."
        actions={
          <Button
            icon={<GitFork className="size-3.5" aria-hidden />}
            onClick={() => forkAsDraft(plan.id)}
          >
            Fork this as a draft
          </Button>
        }
      />

      <Panel className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Baseline" className="min-w-[12rem] flex-1">
            <Select
              value={other?.id ?? null}
              placeholder="Choose a plan to compare against"
              onChange={(id) => setCompare(id)}
              options={plans
                .filter((entry) => entry.id !== plan.id)
                .map((entry) => ({ value: entry.id, label: entry.name }))}
            />
          </Field>
          <ArrowRight className="mb-2 size-4 text-faint" aria-hidden />
          <div className="min-w-[12rem] flex-1">
            <p className="label mb-1.5">This plan</p>
            <p className="flex h-[2.1rem] items-center text-sm font-medium text-strong">
              {plan.name}
              {plan.kind === 'draft' ? <span className="chip ml-2">draft</span> : null}
            </p>
          </div>
        </div>
      </Panel>

      {!other ? (
        <Callout title="Nothing to compare against yet">
          Fork this plan as a draft, change one thing about it, and come back. Comparing candidates
          is the main thing a planner is for, and a tool that makes you overwrite the current plan
          to try an idea is a tool you stop trying ideas in.
        </Callout>
      ) : !delta ? null : (
        <div className="space-y-5">
          <Panel className="p-4">
            <p className="text-sm font-medium text-strong">{summariseDelta(delta)}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map((severity) => {
                const value = delta.severityDelta[severity]
                if (value === 0) return null
                return (
                  <span key={severity} className="flex items-center gap-1.5" data-sev={severity}>
                    <SeverityDot severity={severity} />
                    {severity}
                    <span className={value < 0 ? 'text-ok' : 'text-critical'}>
                      {value > 0 ? `+${value}` : value}
                    </span>
                  </span>
                )
              })}
            </div>
          </Panel>

          {/* Stacked rather than side by side, and that is the better
              comparison as well as the only legible one. Half a column is not
              enough width to draw a plan at a readable size, and stacking puts
              each column of one diagram directly above the same column of the
              other, so a key that moved is a difference in the same place on
              the page rather than one to hunt for. */}
          {shapes ? (
            <div className="grid gap-4">
              <Panel className="p-4">
                <SectionHeading title={other.name} hint="The baseline, as it stands." />
                <PlanDiagram graph={shapes.before} />
              </Panel>
              <Panel className="p-4">
                <SectionHeading title={plan.name} hint="This plan, as it stands." />
                <PlanDiagram graph={shapes.after} />
              </Panel>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="p-4">
              <SectionHeading title="Closed" hint="Present in the baseline, gone here." />
              <FindingList findings={delta.resolved} tone="ok" />
            </Panel>
            <Panel className="p-4">
              <SectionHeading title="Opened" hint="New in this plan." />
              <FindingList findings={delta.introduced} tone="bad" />
            </Panel>
          </div>

          {stillStanding.length > 0 ? (
            <Panel className="p-4">
              <SectionHeading
                title="Still standing, about what you changed"
                hint="Almost always the answer to why nothing closed: the problem was somewhere else."
              />
              <ul className="space-y-2">
                {stillStanding.map((finding) => (
                  <li key={finding.id} className="flex items-start gap-2">
                    <SeverityDot severity={finding.severity} className="mt-[0.45rem]" />
                    <span className="min-w-0">
                      <span className="block text-[0.8125rem] leading-snug text-body">
                        {finding.title}
                      </span>
                      <span className="mono text-[0.6875rem] text-faint">{finding.rule}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {changes.length > 0 ? (
            <Panel className="p-4">
              <SectionHeading
                title="What actually changed"
                hint="In the plan, not in the findings."
              />
              <ul className="space-y-1 text-[0.8125rem]">
                {changes.slice(0, 30).map((change) => (
                  <li key={`${change.entity}:${change.id}`} className="flex items-start gap-2">
                    <span className="mono mt-0.5 w-16 flex-none text-[0.6875rem] text-faint">
                      {change.kind}
                    </span>
                    <span className="text-body">
                      {change.entity} · {change.label}
                      {change.fields.length > 0 ? (
                        <span className="mono block text-[0.6875rem] text-faint">
                          {change.fields.slice(0, 6).join(', ')}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  )
}

function FindingList({ findings, tone }: { findings: Finding[]; tone: 'ok' | 'bad' }) {
  if (findings.length === 0) {
    return <p className="text-sm text-muted">None.</p>
  }
  return (
    <ul className="space-y-2">
      {findings.map((finding) => (
        <li key={finding.id} className="flex items-start gap-2">
          {tone === 'ok' ? (
            <Minus className="mt-1 size-3 flex-none text-ok" aria-hidden />
          ) : (
            <Plus className="mt-1 size-3 flex-none text-critical" aria-hidden />
          )}
          <span className="min-w-0">
            <span className="block text-[0.8125rem] leading-snug text-body">{finding.title}</span>
            <span className="mono text-[0.6875rem] text-faint">
              {finding.rule} · {finding.severity}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
