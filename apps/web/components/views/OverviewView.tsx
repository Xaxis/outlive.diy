'use client'

import { useMemo } from 'react'
import {
  ArrowUpRight,
  CircleCheck,
  CircleSlash,
  CircleX,
  Compass,
  TriangleAlert,
} from 'lucide-react'
import {
  createContext,
  indexPlan,
  overdueVerifications,
  type WalletAvailability,
} from '@outlive/core'
import { Card, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { SeverityBar, SeverityDot } from '@/components/ui/Severity.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useReport, useRunbook } from '@/lib/analysis.ts'
import { href, useRoute } from '@/lib/router.ts'
import { describePolicy, planIsStarted, STAKE, TIER, VERIFICATION_KIND } from '@/lib/describe.ts'
import { cn } from '@/lib/cn.ts'

function WalletState({ availability }: { availability: WalletAvailability }) {
  if (!availability.spendable) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-critical">
        <CircleX className="size-3.5" aria-hidden />
        cannot be spent
      </span>
    )
  }
  if (availability.margin === 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-high">
        <CircleSlash className="size-3.5" aria-hidden />
        no spare keys
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-ok">
      <CircleCheck className="size-3.5" aria-hidden />
      {availability.margin} spare {availability.margin === 1 ? 'key' : 'keys'}
    </span>
  )
}

export function OverviewView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const runbook = useRunbook(plan)
  const forkAsDraft = useStore((state) => state.forkAsDraft)
  const [, navigate] = useRoute()

  const overdue = useMemo(() => (plan ? overdueVerifications(createContext(plan)) : []), [plan])
  const index = useMemo(() => (plan ? indexPlan(plan) : null), [plan])

  if (!plan || !report || !index) return null

  if (!planIsStarted(plan)) {
    return (
      <div className="mx-auto max-w-3xl">
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
    <div className="mx-auto max-w-5xl">
      <ViewHeader
        eyebrow={plan.kind === 'draft' ? 'Draft plan' : 'Current plan'}
        title={plan.name}
        question={`Last changed ${plan.updatedAt}. ${plan.keys.length} keys, ${plan.wallets.length} wallets, ${plan.locations.length} places, ${plan.people.length} people.`}
        actions={
          <>
            <Button onClick={() => forkAsDraft(plan.id)}>Try a change as a draft</Button>
            <Button variant="primary" onClick={() => navigate({ view: 'findings', section: null })}>
              Read the findings
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <Panel className="p-4">
            <SectionHeading
              title="Where each wallet stands today"
              hint="With nothing wrong, and everything in reach."
            />
            {plan.wallets.length === 0 ? (
              <p className="text-sm text-muted">
                No wallets described yet.{' '}
                <a
                  href={href('design', 'wallets')}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  Add one
                </a>
                .
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {report.today.map(({ walletId, availability }) => {
                  const wallet = index.wallets.get(walletId)
                  if (!wallet) return null
                  return (
                    <li
                      key={walletId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-strong">
                          {wallet.label}
                          {wallet.decoy ? <span className="chip ml-2">decoy</span> : null}
                        </span>
                        <span className="mono block text-xs text-faint">
                          {TIER[wallet.tier].toLowerCase()} · {describePolicy(wallet)} ·{' '}
                          {STAKE[wallet.stake].toLowerCase()}
                        </span>
                      </span>
                      <WalletState availability={availability} />
                    </li>
                  )
                })}
              </ul>
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
                      onClick={() => navigate({ view: 'findings', section: null })}
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
    </div>
  )
}
