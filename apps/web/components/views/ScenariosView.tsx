'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, CircleCheck, CircleSlash, CircleX, ShieldX } from 'lucide-react'
import {
  buildGraph,
  indexPlan,
  type ScenarioKind,
  type ScenarioResult,
  type Verdict,
} from '@outlive/core'
import { MEASURE, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { Segmented } from '@/components/ui/Field.tsx'
import { CustomScenario } from '@/components/scenarios/CustomScenario.tsx'
import { Disclosure } from '@/components/ui/Disclosure.tsx'
import { DiagramLegend, DiagramSummary, PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { useActivePlan } from '@/lib/store.ts'
import { useScenarioResults } from '@/lib/analysis.ts'
import { planIsStarted } from '@/lib/describe.ts'
import { NothingYet } from '@/components/shell/NothingYet.tsx'
import { href } from '@/lib/router.ts'
import { cn } from '@/lib/cn.ts'

const VERDICT: Record<Verdict, { label: string; icon: typeof CircleCheck; tone: string }> = {
  safe: { label: 'survives', icon: CircleCheck, tone: 'text-ok' },
  degraded: { label: 'no spare', icon: CircleSlash, tone: 'text-medium' },
  lost: { label: 'unspendable', icon: CircleX, tone: 'text-critical' },
  exposed: { label: 'they can spend', icon: ShieldX, tone: 'text-critical' },
}

const GROUPS: {
  id: 'loss' | 'compromise'
  label: string
  kinds: ScenarioKind[]
  question: string
}[] = [
  {
    id: 'loss',
    label: 'Something is gone',
    question: 'Remove one thing. Can you still move the coins?',
    kinds: [
      'location-lost',
      'disaster-group-lost',
      'key-lost',
      'device-lost',
      'backup-lost',
      'config-lost',
      'person-lost',
      'user-death',
    ],
  },
  {
    id: 'compromise',
    label: 'Someone else has it',
    question: 'Take one thing. Can they move the coins?',
    kinds: ['location-compromised', 'person-compromised', 'coercion'],
  },
]

/**
 * The stress test: every scenario the engine can build, run at once.
 *
 * This is the same computation the findings come from, shown as a grid rather
 * than a list, because a table makes a pattern visible that a ranked list
 * hides: one column of red down a single wallet, or one row of red across every
 * wallet at once.
 *
 * The grid says which scenarios end badly. Opening one draws it, which is the
 * part that says why: the verdict in a cell is a conclusion, and the picture
 * beside it is the chain of dependencies that produced the conclusion.
 */
export function ScenariosView() {
  const plan = useActivePlan()
  const results = useScenarioResults(plan)
  const index = useMemo(() => (plan ? indexPlan(plan) : null), [plan])
  const [group, setGroup] = useState<'loss' | 'compromise'>('loss')
  const [onlyAlarming, setOnlyAlarming] = useState<'all' | 'bad'>('bad')
  const [openId, setOpenId] = useState<string | null>(null)

  if (!plan || !index) return null

  if (!planIsStarted(plan)) {
    return (
      <div className={MEASURE.wide}>
        <ViewHeader
          eyebrow="Diagnosis"
          title="Stress test"
          question="Every way this plan comes apart, run at once."
        />
        <NothingYet what="there is nothing to take away from it." />
      </div>
    )
  }

  const definition = GROUPS.find((entry) => entry.id === group)!
  const rows = results
    .filter((result) => definition.kinds.includes(result.scenario.kind))
    .filter((result) => onlyAlarming === 'all' || result.alarming)

  const wallets = plan.wallets
  const open = rows.find((result) => result.scenario.id === openId) ?? null
  const graph = open ? buildGraph(plan, open.scenario.world) : null

  return (
    <div className={MEASURE.wide}>
      <ViewHeader eyebrow="Diagnosis" title="Stress test" question={definition.question} />

      {/* Both switches change the same table, so they belong in the same row. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={group}
          onChange={setGroup}
          options={GROUPS.map((entry) => ({ value: entry.id, label: entry.label }))}
        />
        <Segmented
          value={onlyAlarming}
          onChange={setOnlyAlarming}
          options={[
            { value: 'bad', label: 'Only the bad ones' },
            { value: 'all', label: 'Everything' },
          ]}
        />
      </div>

      {wallets.length === 0 ? (
        <p className="text-sm text-muted">
          No wallets described yet, so there is nothing to break.
        </p>
      ) : rows.length === 0 ? (
        <Panel className="p-6">
          <h2 className="text-sm font-semibold text-strong">
            {onlyAlarming === 'bad' ? 'None of these break anything' : 'No scenarios to run'}
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            {onlyAlarming === 'bad'
              ? 'Every scenario in this group leaves every wallet in the state you would want. Switch to Everything to see the working.'
              : 'Describe some places, keys and wallets first.'}
          </p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-surface p-3 text-left">
                  <span className="eyebrow">Scenario</span>
                </th>
                {wallets.map((wallet) => (
                  <th
                    key={wallet.id}
                    scope="col"
                    className="min-w-[8rem] border-b border-line p-3 text-left text-[0.8125rem] font-semibold text-strong"
                  >
                    {wallet.label}
                    {wallet.decoy ? (
                      <span className="mono block text-[0.6875rem] font-normal text-faint">
                        decoy
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((result) => (
                <ScenarioRow
                  key={result.scenario.id}
                  result={result}
                  walletIds={wallets.map((w) => w.id)}
                  open={result.scenario.id === openId}
                  onOpen={() =>
                    setOpenId(result.scenario.id === openId ? null : result.scenario.id)
                  }
                />
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {open && graph ? (
        <Panel className="mt-4 p-4">
          <SectionHeading title={open.scenario.label} hint={open.scenario.question} />
          <PlanDiagram graph={graph} />
          <div className="mt-4 border-t border-line pt-3">
            <DiagramSummary graph={graph} />
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <DiagramLegend graph={graph} />
          </div>
        </Panel>
      ) : null}

      {/* The table above is the page. Composing a world by hand is the thing
          you come back for once the table has told you where to look, and it
          was taking more room than the answer it exists to refine. */}
      <Disclosure
        className="mt-6"
        title="Compose your own"
        hint="Nothing goes wrong one thing at a time. Switch several off at once."
      >
        <CustomScenario plan={plan} />
      </Disclosure>

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-faint">
        Each of these worlds makes different assumptions about what you know and where you are.{' '}
        <a href={href('reasoning')} className="link">
          How it reasons
        </a>{' '}
        sets them out, and{' '}
        <a href={href('recovery')} className="link">
          every one of them has a written recovery route
        </a>
        .
      </p>
    </div>
  )
}

function ScenarioRow({
  result,
  walletIds,
  open,
  onOpen,
}: {
  result: ScenarioResult
  walletIds: string[]
  open: boolean
  onOpen: () => void
}) {
  return (
    <tr className={cn('border-b border-line align-top', open && 'bg-[rgb(var(--tint)/0.04)]')}>
      <th scope="row" className="sticky left-0 z-10 bg-surface p-0 text-left font-normal">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          className="flex w-full items-start gap-2 p-3 text-left transition-colors hover:bg-[rgb(var(--tint)/0.04)]"
        >
          <ChevronRight
            className={cn(
              'mt-0.5 size-3.5 flex-none text-faint transition-transform',
              open && 'rotate-90'
            )}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-[0.8125rem] text-body">{result.scenario.label}</span>
            <span className="mono block text-[0.6875rem] text-faint">
              {result.scenario.question}
            </span>
          </span>
        </button>
      </th>
      {walletIds.map((walletId) => {
        const outcome = result.wallets.find((entry) => entry.walletId === walletId)
        if (!outcome)
          return (
            <td key={walletId} className="p-3 text-faint">
              ·
            </td>
          )
        const verdict = VERDICT[outcome.verdict]
        const Icon = verdict.icon
        return (
          <td key={walletId} className="p-3">
            <span className={cn('flex items-center gap-1.5 text-xs', verdict.tone)}>
              <Icon className="size-3.5 flex-none" aria-hidden />
              {verdict.label}
            </span>
            {outcome.verdict === 'lost' && outcome.availability.blockers.length > 0 ? (
              <span className="mt-0.5 block text-[0.6875rem] leading-snug text-faint">
                {outcome.availability.blockers[0]}
              </span>
            ) : null}
          </td>
        )
      })}
    </tr>
  )
}
