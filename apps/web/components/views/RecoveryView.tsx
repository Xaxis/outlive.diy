'use client'

import { useState } from 'react'
import { MapPin, Printer, TriangleAlert } from 'lucide-react'
import { describeDuration, indexPlan, type RecoveryRoute } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { PrintHeader } from '@/components/shell/PrintHeader.tsx'
import { Rehearsal } from '@/components/documents/Rehearsal.tsx'
import { Timeline } from '@/components/documents/Timeline.tsx'
import { MEASURE, ViewHeader } from '@/components/ui/Surface.tsx'
import { ItemList } from '@/components/ui/ItemList.tsx'
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
      <div className={MEASURE.read}>
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
    <div className={MEASURE.read}>
      <PrintHeader />

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
        /* Shut on screen, open on paper. Fourteen expanded routes is a document
           you cannot see the shape of; the list of ways this fails, with the
           verdict and the time beside each, is the thing worth reading first.
           Printed, it has to be whole, because that is the copy that ends up
           next to the backups. */
        <ItemList
          autoOpenNew={false}
          printOpen
          items={visible.map((route) => ({
            id: route.scenarioId,
            title: route.title,
            summary: summarise(route, (id) => index.wallets.get(id)?.label ?? 'a wallet'),
            badge: (
              <span
                className={cn(
                  'chip',
                  route.possible ? 'border-ok/50 text-ok' : 'border-critical/50 text-critical'
                )}
              >
                {route.possible ? 'recoverable' : 'no route'}
              </span>
            ),
            body: (
              <Route
                route={route}
                labelFor={(id) => index.locations.get(id)?.label ?? 'a location'}
                walletLabel={(id) => index.wallets.get(id)?.label ?? 'a wallet'}
              />
            ),
          }))}
        />
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
    <div>
      <p className="text-[0.8125rem] leading-relaxed text-muted">{route.situation}</p>

      <div className="mt-3 flex gap-2.5 rounded-[var(--radius-control)] border border-line bg-sunken p-3">
        <TriangleAlert className="mt-0.5 size-3.5 flex-none text-medium" aria-hidden />
        <p className="text-[0.8125rem] leading-relaxed text-body">{route.firstMove}</p>
      </div>

      {route.timing ? (
        <div className="mt-3 rounded-[var(--radius-control)] border border-line p-3">
          <p className="eyebrow mb-1.5">How long this takes</p>
          <Timeline timing={route.timing} />
        </div>
      ) : null}

      {route.exposedWalletIds.length > 0 ? (
        /* The one thing on this card with a clock on it. It is in the
           situation sentence too, and a sentence is not where a reader looks
           for the list of what to move first. */
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-critical">
          Somebody else can spend: {route.exposedWalletIds.map(walletLabel).join(', ')}. Move{' '}
          {route.exposedWalletIds.length === 1 ? 'it' : 'them'} before anything else on this page.
        </p>
      ) : null}

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
    </div>
  )
}

/**
 * What a route says when its row is shut: whether it works, and how long.
 *
 * When somebody else can spend something, that goes first. These rows are read
 * shut, on the day, and "they can spend Daily" is the line that has to be
 * acted on within the hour; whether your own recovery takes four steps or five
 * can wait until after.
 */
function summarise(route: RecoveryRoute, walletLabel: (id: string) => string): string {
  const exposed =
    route.exposedWalletIds.length > 0
      ? `they can spend ${route.exposedWalletIds.map(walletLabel).join(', ')}`
      : null
  if (!route.possible)
    return [exposed, `nothing recovers it${route.blockers[0] ? `: ${route.blockers[0]}` : ''}`]
      .filter(Boolean)
      .join(' · ')
  const time = route.timing?.possible
    ? describeDuration(route.timing.days, route.timing.travelMinutes)
    : null
  const steps = `${route.steps.length} ${route.steps.length === 1 ? 'step' : 'steps'}`
  return [exposed, time, steps].filter(Boolean).join(' · ')
}
