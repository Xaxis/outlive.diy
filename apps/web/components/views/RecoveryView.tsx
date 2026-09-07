'use client'

import { useState } from 'react'
import { MapPin, Printer, TriangleAlert } from 'lucide-react'
import { indexPlan, type RecoveryRoute } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { PrintHeader } from '@/components/shell/PrintHeader.tsx'
import { Rehearsal } from '@/components/documents/Rehearsal.tsx'
import { Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { Segmented } from '@/components/ui/Field.tsx'
import { useActivePlan } from '@/lib/store.ts'
import { useRecovery } from '@/lib/analysis.ts'
import { planIsStarted } from '@/lib/describe.ts'
import { NothingYet } from '@/components/shell/NothingYet.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * One short procedure per way this fails.
 *
 * Computed from the same scenarios the findings use, so a route cannot claim a
 * recovery the analysis says is impossible. Where there is no route, the page
 * says which specific thing is missing rather than offering encouragement.
 */
export function RecoveryView() {
  const plan = useActivePlan()
  const routes = useRecovery(plan)
  const [filter, setFilter] = useState<'all' | 'possible' | 'impossible'>('all')

  if (!plan) return null

  if (!planIsStarted(plan)) {
    return (
      <div className="mx-auto max-w-3xl">
        <ViewHeader
          eyebrow="Documents"
          title="Recovery routes"
          question="What to do, in order, for each way this can go wrong."
        />
        <NothingYet what="there is nothing that could go wrong with it." />
      </div>
    )
  }

  const index = indexPlan(plan)

  const visible = routes.filter((route) =>
    filter === 'all' ? true : filter === 'possible' ? route.possible : !route.possible
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PrintHeader title="Recovery routes" />

      <ViewHeader
        eyebrow="Documents"
        title="Recovery routes"
        question="What to do, in order, for each way this can go wrong. Rehearse one and it stops being an assumption. Print them and keep them with the backups, not on the machine you may have lost."
        actions={
          <>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'possible', label: 'Recoverable' },
                { value: 'impossible', label: 'No route' },
              ]}
            />
            <Button
              variant="default"
              onClick={() => window.print()}
              icon={<Printer className="size-3.5" aria-hidden />}
            >
              Print
            </Button>
          </>
        }
      />

      {visible.length === 0 ? (
        <p className="text-sm text-muted">Nothing in that filter.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((route) => (
            <Route
              key={route.scenarioId}
              route={route}
              labelFor={(id) => index.locations.get(id)?.label ?? 'a location'}
              walletLabel={(id) => index.wallets.get(id)?.label ?? 'a wallet'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Route({
  route,
  labelFor,
  walletLabel,
}: {
  route: RecoveryRoute
  labelFor: (id: string) => string
  walletLabel: (id: string) => string
}) {
  return (
    <Panel className="p-4 print-block">
      <header className="border-b border-line pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[0.95rem] font-semibold text-strong">{route.title}</h2>
          <span
            className={cn(
              'chip',
              route.possible ? 'border-ok/50 text-ok' : 'border-critical/50 text-critical'
            )}
          >
            {route.possible ? 'recoverable' : 'no route'}
          </span>
        </div>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{route.situation}</p>
      </header>

      <div className="mt-3 flex gap-2.5 rounded-[var(--radius-control)] border border-line bg-sunken p-3">
        <TriangleAlert className="mt-0.5 size-3.5 flex-none text-medium" aria-hidden />
        <p className="text-[0.8125rem] leading-relaxed text-body">{route.firstMove}</p>
      </div>

      {route.lostWalletIds.length > 0 ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-critical">
          Cannot be recovered in this situation: {route.lostWalletIds.map(walletLabel).join(', ')}.
        </p>
      ) : null}

      {route.blockers.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[0.8125rem] leading-relaxed text-muted">
          {route.blockers.slice(0, 5).map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}

      {route.steps.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {route.steps.map((step, position) => (
            <li key={`${route.scenarioId}-${position}`} className="flex gap-3">
              <span className="mono mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border border-line-strong text-[0.6875rem] text-faint">
                {position + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[0.875rem] font-medium text-strong">{step.title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{step.detail}</p>
                {step.locationId ? (
                  <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-faint">
                    <MapPin className="size-3" aria-hidden />
                    {labelFor(step.locationId)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {route.possible && route.walletIds.length > 0 ? (
        <p className="mt-3 border-t border-line pt-3 text-[0.75rem] text-faint">
          This route recovers: {route.walletIds.map(walletLabel).join(', ')}.
        </p>
      ) : null}

      <Rehearsal route={route} />
    </Panel>
  )
}
