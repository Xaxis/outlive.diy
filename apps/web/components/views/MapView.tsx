'use client'

import { useMemo, useState } from 'react'
import { buildGraph, type Ref } from '@outlive/core'
import { MEASURE, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { DiagramLegend, DiagramSummary, PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { LensPicker, useLens } from '@/components/graph/Lens.tsx'
import { WalletStanding } from '@/components/graph/WalletStanding.tsx'
import { QuorumTable } from '@/components/map/QuorumTable.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { NothingYet } from '@/components/shell/NothingYet.tsx'
import { navigateTo, useRoute } from '@/lib/router.ts'

/**
 * The map.
 *
 * The plan drawn as what it is: a chain of dependencies ending in physical
 * places. The control at the top takes one thing away and the picture answers,
 * which is the only way to see a custody structure rather than read about it.
 *
 * The table underneath is the same arithmetic in numbers. It stays because
 * quorum per location is a thing people need to read off exactly, and a diagram
 * is bad at exact.
 */
export function MapView() {
  const plan = useActivePlan()
  const select = useStore((state) => state.select)
  // The fragment can name a scenario, which is how a finding sends a reader
  // here to see the world it came out of.
  const [route] = useRoute()
  const lens = useLens(plan, route.section)
  const [walletId, setWalletId] = useState<string | null>(null)

  const graph = useMemo(
    () => (plan && lens.world ? buildGraph(plan, lens.world, { walletId }) : null),
    [plan, lens.world, walletId]
  )

  if (!plan) return null

  if (plan.locations.length === 0 || plan.keys.length === 0) {
    return (
      <div className={MEASURE.wide}>
        <ViewHeader eyebrow="Diagnosis" title="Map" question="What this plan rests on." />
        <NothingYet what="there is nothing to draw: the map needs at least one place and one key." />
      </div>
    )
  }

  const open = (ref: Ref) => {
    if (ref.type === 'location') navigateTo('design', 'locations')
    else if (ref.type === 'key') navigateTo('design', 'keys')
    else if (ref.type === 'wallet' || ref.type === 'path') navigateTo('design', 'wallets')
    else if (ref.type === 'device') navigateTo('design', 'devices')
    else if (ref.type === 'person') navigateTo('design', 'people')
    else if (ref.type === 'backup') navigateTo('design', 'keys')
    if (ref.type === 'path' || ref.type === 'backup') return
    select(ref)
  }

  return (
    <div className={MEASURE.wide}>
      <ViewHeader
        eyebrow="Diagnosis"
        title="Map"
        question="Everything this plan rests on, drawn. Take one thing away and watch what stops working."
      />

      <Panel className="p-4">
        <div className="mb-4 flex flex-wrap items-end gap-x-5 gap-y-3 no-print">
          <div>
            <label className="label mb-1" htmlFor="map-lens">
              Show the plan
            </label>
            <LensPicker lens={lens} id="map-lens" />
          </div>
          <div>
            <label className="label mb-1" htmlFor="map-wallet">
              Narrowed to
            </label>
            <select
              id="map-wallet"
              className="select max-w-[14rem]"
              value={walletId ?? ''}
              onChange={(event) => setWalletId(event.target.value || null)}
            >
              <option value="">Every wallet</option>
              {plan.wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.label}
                </option>
              ))}
            </select>
          </div>
          <p className="min-w-[14rem] flex-1 text-xs leading-relaxed text-muted">{lens.caption}</p>
        </div>

        <WalletStanding
          plan={plan}
          world={lens.world}
          className="mb-4"
          onSelect={(id) => setWalletId(id === walletId ? null : id)}
        />

        {graph ? (
          <>
            <PlanDiagram graph={graph} onSelect={open} className="print-block" />
            <div className="mt-4 border-t border-line pt-3">
              <DiagramSummary graph={graph} />
            </div>
          </>
        ) : null}

        {graph ? (
          <div className="mt-3 border-t border-line pt-3">
            <DiagramLegend graph={graph} />
          </div>
        ) : null}
      </Panel>

      <div className="mt-6">
        <SectionHeading
          title="The same thing, as numbers"
          hint="How much of each wallet is inside one container. Read this when you need the exact fraction rather than the shape."
        />
        <QuorumTable plan={plan} />
      </div>
    </div>
  )
}
