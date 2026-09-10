'use client'

import { useMemo } from 'react'
import { ArrowUpRight, Compass, TriangleAlert } from 'lucide-react'
import {
  baseWorld,
  buildGraph,
  createContext,
  indexPlan,
  overdueVerifications,
} from '@outlive/core'
import { MEASURE, Card, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { WalletStanding } from '@/components/graph/WalletStanding.tsx'
import { SeverityBar, SeverityDot } from '@/components/ui/Severity.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useReport, useRunbook } from '@/lib/analysis.ts'
import { href, useRoute } from '@/lib/router.ts'
import { planIsStarted, plural, VERIFICATION_KIND } from '@/lib/describe.ts'
import { cn } from '@/lib/cn.ts'

export function OverviewView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const runbook = useRunbook(plan)
  const forkAsDraft = useStore((state) => state.forkAsDraft)
  const [, navigate] = useRoute()

  const overdue = useMemo(() => (plan ? overdueVerifications(createContext(plan)) : []), [plan])
  const index = useMemo(() => (plan ? indexPlan(plan) : null), [plan])
  const world = useMemo(() => (plan ? baseWorld(plan) : null), [plan])
  const graph = useMemo(
    () => (plan && world && plan.wallets.length > 0 ? buildGraph(plan, world) : null),
    [plan, world]
  )

  if (!plan || !report || !index || !world) return null

  if (!planIsStarted(plan)) {
    return (
      <div className={MEASURE.wide}>
        <ViewHeader
          eyebrow="Plan"
          title={plan.name}
          question="Nothing is described yet. The guided route asks about places first, because everything else in a custody plan is a statement about where something is."
        />
        <Card className="p-6">
          <Compass className="size-5 text-accent" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-strong">Start with the guided route</h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            Eight steps: what you are protecting against, the places, the people, the devices, the
            keys, the wallets, the checks, and then what breaks. You can leave at any point and edit
            anything directly.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => navigate({ view: 'start', section: null })}>
              Begin
            </Button>
            <Button onClick={() => navigate({ view: 'design', section: 'locations' })}>
              Just let me edit
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const top = report.findings.slice(0, 4)
  const gates = runbook?.gates.length ?? 0

  return (
    <div className={MEASURE.wide}>
      <ViewHeader
        eyebrow={plan.kind === 'draft' ? 'Draft plan' : 'Current plan'}
        title={plan.name}
        question={`Last changed ${plan.updatedAt}. ${plural(plan.keys.length, 'key')}, ${plural(plan.wallets.length, 'wallet')}, ${plural(plan.locations.length, 'place')}, ${plural(plan.people.length, 'person', 'people')}.`}
        actions={
          <>
            <Button onClick={() => forkAsDraft(plan.id)}>Try a change as a draft</Button>
            <Button variant="primary" onClick={() => navigate({ view: 'findings', section: null })}>
              Read the findings
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,20rem)]">
        <div className="space-y-4">
          <Panel className="p-4">
            <SectionHeading
              title="Where each wallet stands today"
              hint="With nothing wrong, everything in reach, and how long getting there would take."
            />
            {plan.wallets.length === 0 ? (
              <p className="text-sm text-muted">
                No wallets described yet.{' '}
                <a href={href('design', 'wallets')} className="link">
                  Add one
                </a>
                .
              </p>
            ) : (
              <WalletStanding
                plan={plan}
                world={world}
                onSelect={() => navigate({ view: 'map', section: null })}
              />
            )}
          </Panel>

          <Panel className="p-4">
            <SectionHeading
              title="What to deal with first"
              actions={
                <a href={href('findings')} className="chip no-underline hover:border-line-strong">
                  all {report.findings.length}
                  <ArrowUpRight className="size-3" aria-hidden />
                </a>
              }
            />
            {top.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing found. Read the staleness section before believing it.
              </p>
            ) : (
              <ul className="space-y-2">
                {top.map((finding) => (
                  <li key={finding.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ view: 'findings', section: finding.id })}
                      className="flex w-full items-start gap-2.5 text-left"
                    >
                      <SeverityDot severity={finding.severity} className="mt-[0.45rem]" />
                      <span className="min-w-0">
                        <span className="block text-sm leading-snug text-body">
                          {finding.title}
                        </span>
                        <span className="mono text-[0.6875rem] text-faint">{finding.rule}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <SectionHeading title="Findings" hint="No score. Just the list." />
            <SeverityBar counts={report.counts} />
          </Panel>

          <Panel className="p-4">
            <SectionHeading title="Overdue" hint="What has gone back to being an assumption." />
            {overdue.length === 0 ? (
              <p className="text-sm text-muted">
                {plan.verifications.length === 0
                  ? 'Nothing is scheduled to be checked yet, which means nothing here has been tested.'
                  : 'Everything scheduled is current.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {overdue.slice(0, 5).map((entry) => (
                  <li key={entry.verification.id} className="flex items-start gap-2.5">
                    <TriangleAlert className="mt-0.5 size-3.5 flex-none text-medium" aria-hidden />
                    <span className="text-sm leading-snug text-body">
                      {VERIFICATION_KIND[entry.verification.kind]}
                      <span className="block text-xs text-faint">
                        {entry.lastVerifiedAt === null
                          ? 'never done'
                          : `${entry.overdueDays} days overdue`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-4">
            <SectionHeading title="Documents" hint="Print them. They belong on paper." />
            <ul className="space-y-1.5 text-sm">
              {[
                {
                  view: 'runbook' as const,
                  label: 'Build runbook',
                  note: `${gates} verification gates`,
                },
                {
                  view: 'recovery' as const,
                  label: 'Recovery routes',
                  note: 'one per way it fails',
                },
                { view: 'letter' as const, label: 'Successor letter', note: 'no secrets in it' },
              ].map((item) => (
                <li key={item.view}>
                  <a
                    href={href(item.view)}
                    className={cn(
                      'flex items-baseline justify-between gap-3 rounded-[var(--radius-control)] px-2 py-1.5 no-underline transition-colors',
                      'hover:bg-[rgb(var(--tint)/0.05)]'
                    )}
                  >
                    <span className="text-body">{item.label}</span>
                    <span className="text-xs text-faint">{item.note}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* The shape of the thing. Full width, and outside the two-column grid,
          because half a column is not enough to draw a plan at a size anybody
          can read and the fallback is a picture with its last columns cut off. */}
      {graph ? (
        <Panel className="mt-4 p-4">
          <SectionHeading
            title="What it rests on"
            hint="A chain of dependencies ending in physical places. The map takes one thing away and redraws it."
            actions={
              <a href={href('map')} className="chip no-underline hover:border-line-strong">
                open the map
                <ArrowUpRight className="size-3" aria-hidden />
              </a>
            }
          />
          <PlanDiagram
            graph={graph}
            height="30rem"
            onSelect={() => navigate({ view: 'map', section: null })}
          />
        </Panel>
      ) : null}
    </div>
  )
}
