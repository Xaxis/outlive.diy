'use client'

import { useMemo, useState } from 'react'
import { buildGraph, type Ref, type World } from '@outlive/core'
import { MEASURE, Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { Disclosure } from '@/components/ui/Disclosure.tsx'
import { DiagramLegend, DiagramSummary, PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { useLens } from '@/components/graph/Lens.tsx'
import { WorldRail } from '@/components/graph/WorldRail.tsx'
import { NodeDetail } from '@/components/graph/NodeDetail.tsx'
import { WalletStanding } from '@/components/graph/WalletStanding.tsx'
import { CustomScenario } from '@/components/scenarios/CustomScenario.tsx'
import { QuorumTable } from '@/components/map/QuorumTable.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useReport, useScenarioResults } from '@/lib/analysis.ts'
import { NothingYet } from '@/components/shell/NothingYet.tsx'
import { navigateTo, useRoute } from '@/lib/router.ts'

/**
 * The map, which is now where the diagnosis happens rather than a picture of
 * it.
 *
 * There were two pages asking one question. The stress test listed every world
 * the engine can build and gave each a verdict; the map drew one world at a
 * time and made you find it in a dropdown. The list is the control for the
 * drawing, so it is beside the drawing, and the page that had the list without
 * the picture is gone.
 *
 * The loop this page runs is the point of it: pick a world on the left, read
 * the picture, click the box that surprised you, and the panel underneath says
 * what the engine knows about that box in that world. From there, take the
 * thing away and the picture is redrawn again.
 *
 * Everything here shares one selection and one world. Clicking a node used to
 * navigate away to a form, which threw away the world in order to show a field.
 * Editing is a deliberate action inside the panel rather than the consequence
 * of looking at something.
 */

/**
 * How tall the working area is: most of the screen, with room for the panel
 * underneath to show its top edge, and bounded so that a very tall window does
 * not leave the drawing floating in the middle of nothing.
 */
const CANVAS_HEIGHT = 'clamp(22rem, calc(100dvh - 22rem), 40rem)'

export function MapView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const results = useScenarioResults(plan)
  const select = useStore((state) => state.select)
  // The fragment can name a scenario, which is how a finding sends a reader
  // here to see the world it came out of.
  const [route] = useRoute()
  const lens = useLens(plan, route.section)
  const [composed, setComposed] = useState<World | null>(null)
  // The height the drawing needs, so that the list beside it stops where it
  // stops. Two columns of different heights beside each other read as one of
  // them having failed to fill.
  const [drawingHeight, setDrawingHeight] = useState<number | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const world = composed ?? lens.world
  const byScenario = useMemo(
    () => new Map(results.map((result) => [result.scenario.id, result])),
    [results]
  )

  const graph = useMemo(
    () => (plan && world ? buildGraph(plan, world, { walletId }) : null),
    [plan, world, walletId]
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

      <div
        className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]"
        style={
          {
            // Never taller than the drawing needs, and never so short that the
            // list beside it shows three worlds out of twenty two.
            '--canvas-h': drawingHeight
              ? `min(${CANVAS_HEIGHT}, max(26rem, ${drawingHeight}px))`
              : CANVAS_HEIGHT,
          } as React.CSSProperties
        }
      >
        <Panel className="flex h-[22rem] flex-col overflow-hidden lg:h-[var(--canvas-h)] no-print">
          <WorldRail
            groups={lens.groups}
            results={byScenario}
            wallets={plan.wallets}
            activeId={composed ? null : lens.id}
            onPick={(id) => {
              // Choosing an enumerated world puts the composed one down. The
              // composer keeps its switches, and says nothing again until one
              // of them moves.
              setComposed(null)
              lens.set(id)
            }}
          >
            <Disclosure
              size="aside"
              title="Compose a world of your own"
              hint="Nothing goes wrong one thing at a time."
            >
              <CustomScenario plan={plan} onChange={setComposed} />
            </Disclosure>
          </WorldRail>
        </Panel>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 no-print">
            <p className="min-w-[16rem] flex-1 text-xs leading-relaxed text-muted">
              {composed
                ? 'A world you composed. Everything switched off in the composer is gone from this drawing.'
                : lens.caption}
            </p>
            <label className="flex flex-none items-center gap-2 whitespace-nowrap text-xs text-faint">
              Narrowed to
              <select
                className="select max-w-[12rem] py-1 text-xs"
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
            </label>
          </div>

          {graph ? (
            <PlanDiagram
              graph={graph}
              height="var(--canvas-h)"
              onHeight={setDrawingHeight}
              selectedId={selectedId}
              onSelectNode={(id) => setSelectedId(id === selectedId ? null : id)}
              className="print-block"
            />
          ) : null}
        </div>
      </div>

      {graph ? (
        <Panel className="mt-4 p-4">
          <WalletStanding
            plan={plan}
            world={world}
            className="mb-4"
            onSelect={(id) => setSelectedId(`wallet:${id}` === selectedId ? null : `wallet:${id}`)}
          />

          {/* One slot under the picture. With nothing chosen it says what this
              world did to the plan; with a box chosen it answers about that
              box. The same question at two resolutions, and never both. */}
          <div className="border-t border-line pt-3">
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
                <Disclosure
                  size="aside"
                  title="What the drawing means"
                  className="mt-3 border-t border-line pt-3"
                >
                  <DiagramLegend graph={graph} />
                </Disclosure>
              </>
            )}
          </div>
        </Panel>
      ) : null}

      <Disclosure
        className="mt-4"
        title="The same thing, as numbers"
        hint="How much of each wallet is inside one container, exactly."
      >
        <QuorumTable plan={plan} />
      </Disclosure>
    </div>
  )
}
