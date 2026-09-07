'use client'

import { useMemo } from 'react'
import { ArrowRight, GitFork, Minus, Plus } from 'lucide-react'
import { analyze, compareReports, comparePlans, summariseDelta, type Finding } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { Callout, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { Select } from '@/components/ui/Field.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
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

  if (!plan) return null

  return (
    <div className="mx-auto max-w-4xl">
      <ViewHeader
        eyebrow="Judgement"
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
          <div className="min-w-[12rem] flex-1">
            <p className="label mb-1.5">Baseline</p>
            <Select
              value={other?.id ?? null}
              placeholder="Choose a plan to compare against"
              onChange={(id) => setCompare(id)}
              options={plans
                .filter((entry) => entry.id !== plan.id)
                .map((entry) => ({ value: entry.id, label: entry.name }))}
            />
          </div>
          <ArrowRight className="mb-2 size-4 text-faint" aria-hidden />
          <div className="min-w-[12rem] flex-1">
            <p className="label mb-1.5">This plan</p>
            <p className="input cursor-default">{plan.name}</p>
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
