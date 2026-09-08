'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { buildGraph, type Ref } from '@outlive/core'
import { MEASURE, Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { DiagramLegend, DiagramSummary, PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { LensPicker, useLens } from '@/components/graph/Lens.tsx'
import { NodeDetail } from '@/components/graph/NodeDetail.tsx'
import { WalletStanding } from '@/components/graph/WalletStanding.tsx'
import { QuorumTable } from '@/components/map/QuorumTable.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useReport } from '@/lib/analysis.ts'
import { NothingYet } from '@/components/shell/NothingYet.tsx'
import { navigateTo, useRoute } from '@/lib/router.ts'
import { cn } from '@/lib/cn.ts'

/**
 * The map.
 *
 * One instrument, and the loop it runs is the point of it: pick a world, read
 * the picture, click the box that surprised you, and the panel underneath says
 * what the engine knows about that box in that world. From there, take the
 * thing away and the picture is redrawn again.
 *
 * Everything on this page shares one selection and one world. Clicking a node
 * used to navigate away to a form, which threw away the world in order to show
 * a field. Editing is now a deliberate action inside the panel rather than the
 * consequence of looking at something.
 *
 * The table at the bottom is the same arithmetic in numbers, folded away
 * because the shape is what this page is for and the exact fraction is what you
 * come back for.
 */
export function MapView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const select = useStore((state) => state.select)
  // The fragment can name a scenario, which is how a finding sends a reader
  // here to see the world it came out of.
  const [route] = useRoute()
  const lens = useLens(plan, route.section)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)

  const graph = useMemo(
    () => (plan && lens.world ? buildGraph(plan, lens.world, { walletId }) : null),
    [plan, lens.world, walletId]
  )

  const selected = graph?.nodes.find((node) => node.id === selectedId) ?? null

  if (!plan || !report) return null

  if (plan.locations.length === 0 || plan.keys.length === 0) {
    return (
      <div className={MEASURE.wide}>
        <ViewHeader eyebrow="Diagnosis" title="Map" question="What this plan rests on." />
        <NothingYet what="there is nothing to draw: the map needs at least one place and one key." />
      </div>
    )
  }

  const edit = (ref: Ref) => {
    const section =
      ref.type === 'location'
        ? 'locations'
        : ref.type === 'person'
          ? 'people'
          : ref.type === 'device'
            ? 'devices'
            : ref.type === 'backup' || ref.type === 'key'
              ? 'keys'
              : 'wallets'
    // A backup and a path are edited inside the thing that owns them, so the
    // selection has to point at an owner rather than at the part.
    if (ref.type !== 'backup' && ref.type !== 'path') select(ref)
    navigateTo('design', section)
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
          onSelect={(id) => setSelectedId(`wallet:${id}` === selectedId ? null : `wallet:${id}`)}
        />

        {graph ? (
          <>
            <PlanDiagram
              graph={graph}
              selectedId={selectedId}
              onSelectNode={(id) => setSelectedId(id === selectedId ? null : id)}
              className="print-block"
            />

            {/* One slot under the picture. With nothing chosen it says what this
                world did to the plan; with a box chosen it answers about that
                box. The same question at two resolutions. */}
            <div className="mt-4 border-t border-line pt-3">
              {selected ? (
                <NodeDetail
                  plan={plan}
                  graph={graph}
                  report={report}
                  node={selected}
                  lens={lens}
                  onEdit={edit}
                  onClear={() => setSelectedId(null)}
                />
              ) : (
                <>
                  <DiagramSummary graph={graph} />
                  <p className="mt-2 text-xs text-faint">
                    Click any box for what this world does to it, and for the two ways of taking it
                    away.
                  </p>
                </>
              )}
            </div>

            <div className="mt-3 border-t border-line pt-3">
              <DiagramLegend graph={graph} />
            </div>
          </>
        ) : null}
      </Panel>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-expanded={showTable}
          className="flex items-center gap-2 text-left no-print"
        >
          <ChevronRight
            className={cn(
              'size-4 flex-none text-faint transition-transform',
              showTable && 'rotate-90'
            )}
            aria-hidden
          />
          <span>
            <span className="block text-[0.95rem] font-semibold text-strong">
              The same thing, as numbers
            </span>
            <span className="block text-xs text-faint">
              How much of each wallet is inside one container, exactly.
            </span>
          </span>
        </button>
        <div hidden={!showTable} className="mt-3">
          <QuorumTable plan={plan} />
        </div>
      </div>
    </div>
  )
}
