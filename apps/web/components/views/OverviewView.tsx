'use client'

import { useMemo } from 'react'
import { ArrowUpRight, Circle, Compass, TriangleAlert } from 'lucide-react'
import {
  baseWorld,
  buildGraph,
  createContext,
  indexPlan,
  checksDue,
  createVerification,
  today,
} from '@outlive/core'
import { MEASURE, Card, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { DiagramOmissions, PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { WalletStanding } from '@/components/graph/WalletStanding.tsx'
import { FailureMatrix } from '@/components/graph/FailureMatrix.tsx'
import { ImproveButton } from '@/components/findings/ImproveButton.tsx'
import { AskClaude } from '@/components/ai/AskClaude.tsx'
import { NextMove } from '@/components/findings/NextMove.tsx'
import { SeverityBar, SeverityDot } from '@/components/ui/Severity.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useReport, useRunbook, useScenarioResults } from '@/lib/analysis.ts'
import { href, useRoute } from '@/lib/router.ts'
import { planIsStarted, plural, VERIFICATION_KIND } from '@/lib/describe.ts'
import { cn } from '@/lib/cn.ts'

export function OverviewView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const runbook = useRunbook(plan)
  const results = useScenarioResults(plan)
  const forkAsDraft = useStore((state) => state.forkAsDraft)
  const edit = useStore((state) => state.edit)
  const [, navigate] = useRoute()

  const overdue = useMemo(() => (plan ? checksDue(createContext(plan)) : []), [plan])
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
          question="Nothing is described yet. Describing it asks about places first, because everything else in a custody plan is a statement about where something is."
        />
        <Card className="p-6">
          <Compass className="size-5 text-accent" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-strong">Describe what you have</h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            Seven steps, in an order that makes the answers mean something: what you are protecting
            against, the places, the people, the devices, the keys, the wallets and the checks. Each
            one says why it is being asked, and reads back what your answer did to the analysis. You
            can start anywhere and leave at any point.
          </p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate({ view: 'design', section: null })}>
              Begin
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Which key, wallet or person a check is about. Three rows that all say
  // "restore a backup" are three rows nobody can act on.
  const subjectLabel = (subject: { type: string; id: string }): string | null => {
    const found =
      subject.type === 'key'
        ? index.keys.get(subject.id)
        : subject.type === 'wallet'
          ? index.wallets.get(subject.id)
          : subject.type === 'device'
            ? index.devices.get(subject.id)
            : subject.type === 'person'
              ? index.people.get(subject.id)
              : subject.type === 'location'
                ? index.locations.get(subject.id)
                : null
    return found?.label ?? null
  }

  const top = report.findings.slice(0, 4)
  const gates = runbook?.gates.length ?? 0

  // The checks, where a reader looks first when any are due: at the top on a
  // phone, where the side column otherwise lands two screens down, and in the
  // side column on a wide screen.
  const checks = (className: string) => (
    <Panel className={cn('p-4', className)}>
      {/* A plan built a minute ago has checks nobody could have done
            yet. Calling them overdue, each with a warning, read as a
            telling-off; they are due, and the late ones say so. */}
      <SectionHeading
        title="Checks due"
        hint="Never done, or done too long ago: each is still an assumption until it is done."
      />
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
              {entry.lastVerifiedAt === null ? (
                <Circle className="mt-0.5 size-3.5 flex-none text-faint" aria-hidden />
              ) : (
                <TriangleAlert className="mt-0.5 size-3.5 flex-none text-medium" aria-hidden />
              )}
              <span className="min-w-0 flex-1 text-sm leading-snug text-body">
                {VERIFICATION_KIND[entry.verification.kind]}
                {subjectLabel(entry.verification.subject) ? (
                  <span className="text-muted"> · {subjectLabel(entry.verification.subject)}</span>
                ) : null}
                <span className="block text-xs text-faint">
                  {entry.lastVerifiedAt === null
                    ? 'not done yet'
                    : `${entry.overdueDays} days overdue`}
                </span>
              </span>
              {/* The record, where the reminder is. Going to the checks
                    step to find the same row and type today's date was the
                    whole of the chore. */}
              <Button
                size="sm"
                aria-label={`${VERIFICATION_KIND[entry.verification.kind]}: done today`}
                onClick={() =>
                  edit((draft) => {
                    const target = draft.verifications.find(
                      (check) => check.id === entry.verification.id
                    )
                    // A check nobody scheduled is added, done today.
                    if (target) target.lastVerifiedAt = today()
                    else
                      draft.verifications.push(
                        createVerification({
                          kind: entry.verification.kind,
                          subject: entry.verification.subject,
                          lastVerifiedAt: today(),
                        })
                      )
                  })
                }
              >
                Done today
              </Button>
            </li>
          ))}
        </ul>
      )}
      {overdue.length > 0 ? (
        // The sitting, rather than a row of buttons: one check at a time with
        // how to do it.
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate({ view: 'checkin', section: null })}
          >
            Check in: {overdue.length} {overdue.length === 1 ? 'check' : 'checks'}
          </Button>
          {overdue.length > 5 ? (
            <span className="text-xs text-faint">{overdue.length - 5} more than listed above</span>
          ) : null}
        </div>
      ) : null}
    </Panel>
  )

  return (
    <div className={MEASURE.wide}>
      <ViewHeader
        eyebrow={plan.kind === 'draft' ? 'Draft plan' : 'Current plan'}
        title={plan.name}
        question={`Last changed ${plan.updatedAt}. ${plural(plan.keys.length, 'key')}, ${plural(plan.wallets.length, 'wallet')}, ${plural(plan.locations.length, 'place')}, ${plural(plan.people.length, 'person', 'people')}.`}
        actions={
          <>
            {plan.kind === 'draft' ? (
              <Button onClick={() => navigate({ view: 'compare', section: null })}>
                Compare with the plan
              </Button>
            ) : (
              <Button onClick={() => forkAsDraft(plan.id)}>Try a change as a draft</Button>
            )}
            {report.findings.length > 0 ? <ImproveButton plan={plan} /> : null}
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

          {report.findings.length > 0 ? (
            <Panel className="border-accent/40 p-4">
              <SectionHeading
                title="Your next move"
                hint="Every change this program knows how to make, tried against the whole analysis. This is the one that closes the most without opening anything critical."
              />
              <NextMove plan={plan} />
            </Panel>
          ) : null}

          {checks(overdue.length > 0 ? 'lg:hidden' : 'hidden')}

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
                      <span className="min-w-0 text-sm leading-snug text-body">
                        {finding.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {plan.wallets.length > 0 && results.length > 0 ? (
            <Panel className="p-4">
              <SectionHeading
                title="Every way it fails"
                hint="Each world the engine builds, against each wallet. A column of red is one wallet everything reaches; a row of red is one event that takes everything."
              />
              <FailureMatrix
                results={results}
                wallets={plan.wallets}
                onPick={(id) => navigate({ view: 'map', section: id })}
              />
            </Panel>
          ) : null}

          <Panel className="p-4">
            <SectionHeading
              title="Ask Claude"
              hint="Optional, with your own Anthropic key. Sends the plan's structure and findings, with notes removed, straight to Anthropic. Nothing is sent until you ask."
            />
            <AskClaude
              plan={plan}
              freeText
              suggestions={[
                'Review my plan',
                'What should I do first, this week?',
                'Explain my plan to my successor in plain words',
              ]}
            />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <SectionHeading title="Findings" hint="No score. Just the list." />
            <SeverityBar counts={report.counts} />
          </Panel>

          {checks(overdue.length > 0 ? 'hidden lg:block' : '')}

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
          <DiagramOmissions graph={graph} />
        </Panel>
      ) : null}
    </div>
  )
}
