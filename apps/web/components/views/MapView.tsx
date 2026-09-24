'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eraser, Maximize2, Minimize2, MousePointerClick, RotateCcw, X } from 'lucide-react'
import {
  buildGraph,
  evaluateWallet,
  verdictFor,
  without,
  type GraphNode,
  type Ref,
  type World,
} from '@outlive/core'
import { MEASURE, Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { Disclosure } from '@/components/ui/Disclosure.tsx'
import { Segmented } from '@/components/ui/Field.tsx'
import {
  DiagramLegend,
  DiagramOmissions,
  DiagramSummary,
  PlanDiagram,
} from '@/components/graph/PlanDiagram.tsx'
import { TODAY, useLens } from '@/components/graph/Lens.tsx'
import { NodeDetail } from '@/components/graph/NodeDetail.tsx'
import { WalletStanding } from '@/components/graph/WalletStanding.tsx'
import { CustomScenario } from '@/components/scenarios/CustomScenario.tsx'
import { QuorumTable } from '@/components/map/QuorumTable.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useReport, useScenarioResults } from '@/lib/analysis.ts'
import { NothingYet } from '@/components/shell/NothingYet.tsx'
import { navigateTo, useRoute } from '@/lib/router.ts'
import { SECTION_FOR } from '@/lib/sections.ts'
import { VERDICT } from '@/lib/verdict.ts'
import { cn } from '@/lib/cn.ts'

/**
 * The map, as an instrument.
 *
 * It said "take one thing away and watch what stops working", and taking a
 * thing away meant finding its world in a list of twenty, or selecting its box
 * and then finding a button under the drawing. Now a click on a box takes it
 * away, a second click puts it back, and several can be gone at once. The
 * verdict for every wallet sits on the drawing itself, so the answer to a
 * click is where the click was, on a phone as much as on a desk.
 *
 * The enumerated worlds are a strip above the drawing rather than a column
 * beside it, which gives the drawing the whole width: beside a column it was
 * shrunk to three quarters and unreadable. Knockouts compose on top of the
 * world chosen in the strip through the same `without` every scenario uses, so
 * nothing here is a second evaluator. In a world where somebody else is
 * inside, a knockout starts again from today, because "they broke in, and
 * also the flat burned down" is not a question one set of colours can answer.
 */

const CANVAS = 'clamp(22rem, calc(100dvh - 19rem), 44rem)'

type Removal = { kind: 'locations' | 'objects' | 'people'; id: string }
type Knockout = Removal & { label: string }

/** What a click on a box removes, or null for a box that is not a thing. */
function removal(node: GraphNode): Removal | null {
  if (node.kind === 'place' && node.ref) return { kind: 'locations', id: node.ref.id }
  if (node.kind === 'person' && node.ref) return { kind: 'people', id: node.ref.id }
  if ((node.kind === 'device' || node.kind === 'backup' || node.kind === 'key') && node.ref)
    return { kind: 'objects', id: node.ref.id }
  if (node.kind === 'config') {
    const id = node.id.slice(node.id.indexOf(':') + 1)
    return id.endsWith('-none') ? null : { kind: 'objects', id }
  }
  return null
}

export function MapView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const results = useScenarioResults(plan)
  const select = useStore((state) => state.select)
  const [route] = useRoute()
  const lens = useLens(plan, route.section)
  const [composed, setComposed] = useState<World | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'remove' | 'inspect'>('remove')
  const [knocked, setKnocked] = useState<Knockout[]>([])
  const [full, setFull] = useState(false)
  const [filter, setFilter] = useState<'bad' | 'all'>('bad')

  // Stable, because the composer reports from an effect that depends on it,
  // and it only clears the knockouts when there were some. An inline arrow
  // here re-ran that effect on every render and wiped every click.
  const onComposed = useCallback((next: World | null) => {
    setKnocked((current) => (current.length === 0 ? current : []))
    setComposed(next)
  }, [])

  const start = composed ?? lens.world
  const world = useMemo(() => {
    if (!start || knocked.length === 0 || start.actor === 'adversary') return start
    const of = (kind: Removal['kind']) =>
      knocked.filter((entry) => entry.kind === kind).map((entry) => entry.id)
    return {
      ...without(start, {
        locations: of('locations'),
        objects: of('objects'),
        people: of('people'),
      }),
      label: `Without ${knocked.map((entry) => entry.label).join(', ')}`,
    }
  }, [start, knocked])

  const graph = useMemo(
    () => (plan && world ? buildGraph(plan, world, { walletId }) : null),
    [plan, world, walletId]
  )
  const selected = graph?.nodes.find((node) => node.id === selectedId) ?? null
  const byScenario = useMemo(
    () => new Map(results.map((result) => [result.scenario.id, result])),
    [results]
  )
  const order = useMemo(
    () => [TODAY, ...lens.groups.flatMap((group) => group.scenarios.map((entry) => entry.id))],
    [lens.groups]
  )

  const { id: lensId, set: setLens } = lens
  const pickWorld = (id: string) => {
    setComposed(null)
    setKnocked([])
    setLens(id)
  }

  // [ and ] step through the worlds. Escape leaves full screen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false)
      if (event.key !== '[' && event.key !== ']') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      event.preventDefault()
      const at = composed ? 0 : Math.max(0, order.indexOf(lensId))
      const next = (at + (event.key === ']' ? 1 : -1) + order.length) % order.length
      setComposed(null)
      setKnocked([])
      setLens(order[next])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [order, lensId, setLens, composed])

  // Full screen owns the page: nothing behind it should scroll.
  useEffect(() => {
    if (!full) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [full])

  // The chosen world's chip stays in view as the strip scrolls sideways,
  // without scrolling the page.
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = strip.current
    const chip = element?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!element || !chip) return
    const left = chip.offsetLeft - element.offsetLeft
    if (
      left < element.scrollLeft ||
      left + chip.offsetWidth > element.scrollLeft + element.clientWidth
    )
      element.scrollLeft = left - 24
  }, [lensId])

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
    if (ref.type !== 'backup' && ref.type !== 'path') select(ref)
    navigateTo('design', SECTION_FOR[ref.type])
  }

  const onNode = (id: string) => {
    const node = graph?.nodes.find((entry) => entry.id === id)
    if (!node) return
    const gone = removal(node)
    if (mode === 'inspect' || !gone) {
      setMode('inspect')
      setSelectedId(id === selectedId ? null : id)
      return
    }
    if (start?.actor === 'adversary') {
      setComposed(null)
      setLens(TODAY)
    }
    setSelectedId(null)
    setKnocked((current) =>
      current.some((entry) => entry.id === gone.id)
        ? current.filter((entry) => entry.id !== gone.id)
        : [...current, { ...gone, label: node.label }]
    )
  }

  const adversary = world?.actor === 'adversary'
  const verdicts = world
    ? plan.wallets.map((wallet) => {
        const availability = evaluateWallet(plan, wallet, world)
        return {
          wallet,
          availability,
          verdict: verdictFor(adversary ? 'adversary' : 'availability', availability),
        }
      })
    : []
  const caption = composed
    ? 'A situation you composed by hand.'
    : knocked.length > 0
      ? `${lens.scenario ? `${lens.scenario.label}, and without ` : 'Without '}${knocked
          .map((entry) => entry.label)
          .join(', ')}.`
      : lens.caption

  const worlds = lens.groups.flatMap((group) =>
    group.scenarios.filter(
      (scenario) =>
        filter === 'all' || scenario.id === lensId || byScenario.get(scenario.id)?.alarming === true
    )
  )

  return (
    <div className={MEASURE.wide}>
      <ViewHeader
        eyebrow="Diagnosis"
        title="Map"
        question="Click anything to take it away and watch what stops working. Click it again to put it back."
      />

      <div className="mb-3 flex items-center gap-2 no-print">
        <Segmented
          value={filter}
          onChange={setFilter}
          className="flex-none"
          options={[
            { value: 'bad', label: 'What breaks' },
            { value: 'all', label: `All ${order.length - 1}` },
          ]}
        />
        <div
          ref={strip}
          role="group"
          aria-label="Worlds"
          className="relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1"
        >
          <WorldChip
            label="As it stands"
            active={!composed && knocked.length === 0 && lensId === TODAY}
            onClick={() => pickWorld(TODAY)}
          />
          {worlds.map((scenario) => (
            <WorldChip
              key={scenario.id}
              label={scenario.label}
              active={!composed && lensId === scenario.id}
              verdicts={byScenario.get(scenario.id)?.wallets.map((outcome) => ({
                verdict: outcome.verdict,
                wallet:
                  plan.wallets.find((wallet) => wallet.id === outcome.walletId)?.label ??
                  'A wallet',
              }))}
              onClick={() => pickWorld(scenario.id)}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          full ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-canvas p-3' : 'relative'
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 no-print">
          <p className="min-w-[12rem] flex-1 text-sm text-body">{caption}</p>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'remove', label: 'Click removes' },
              { value: 'inspect', label: 'Click explains' },
            ]}
          />
          <select
            aria-label="Narrow to one wallet"
            className="select w-auto max-w-[10rem] py-1 text-xs"
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
          <button
            type="button"
            onClick={() => setFull((value) => !value)}
            aria-label={full ? 'Leave full screen' : 'Full screen'}
            title={full ? 'Leave full screen (Esc)' : 'Full screen'}
            className="flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-line text-muted hover:border-line-strong hover:text-strong"
          >
            {full ? (
              <Minimize2 className="size-4" aria-hidden />
            ) : (
              <Maximize2 className="size-4" aria-hidden />
            )}
          </button>
        </div>

        {/* The answer to every click, where the click was. */}
        <ul
          className="mb-2 flex flex-wrap gap-1.5"
          aria-live="polite"
          aria-label="What happens to each wallet"
        >
          {verdicts.map(({ wallet, availability, verdict }) => {
            const style = VERDICT[verdict]
            const Icon = style.icon
            const path =
              availability.paths.find((entry) => entry.pathId === availability.viaPathId) ??
              availability.paths[0]
            return (
              <li
                key={wallet.id}
                // The tint and the icon carry the verdict; the words are in
                // the text ramp, because coloured text on its own tint falls
                // under 4.5:1 in the light theme.
                className={cn(
                  'flex items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-1.5 text-sm transition-colors duration-300',
                  style.cell,
                  'text-strong'
                )}
              >
                <Icon className={cn('size-4', style.ink)} strokeWidth={2.5} aria-hidden />
                <span className="font-medium">{wallet.label}</span>
                <span className="font-medium">{style.label}</span>
                {path ? (
                  <span
                    className="mono text-[0.6875rem] text-body"
                    title="keys reachable / keys needed"
                  >
                    {path.availableKeyIds.length}/{path.threshold}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>

        {knocked.length > 0 ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 no-print">
            <span className="text-xs text-faint">Taken away:</span>
            {knocked.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() =>
                  setKnocked((current) => current.filter((item) => item.id !== entry.id))
                }
                className="chip gap-1 border-critical/50 text-body hover:border-critical"
                aria-label={`Put ${entry.label} back`}
              >
                {entry.label}
                <X className="size-3" aria-hidden />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setKnocked([])}
              className="chip gap-1 hover:border-line-strong"
            >
              <RotateCcw className="size-3" aria-hidden />
              Put everything back
            </button>
          </div>
        ) : null}

        {graph ? (
          <div className={cn(full && 'min-h-0 flex-1')}>
            <PlanDiagram
              graph={graph}
              // Never taller than the drawing needs, so a phone is not a
              // screen of empty grey. Safe because the page reserves its
              // scrollbar gutter: a height that follows the width, beside a
              // scrollbar that came and went with the height, was a loop.
              height={full ? 'calc(100dvh - 11rem)' : CANVAS}
              minHeight={full ? 'calc(100dvh - 11rem)' : '16rem'}
              selectedId={mode === 'inspect' ? selectedId : null}
              onSelectNode={onNode}
              marked={{ ids: new Set(knocked.map((entry) => entry.id)), label: 'removed' }}
              className="print-block"
            />
          </div>
        ) : null}

        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-faint no-print">
          <span className="flex items-center gap-1">
            {mode === 'remove' ? (
              <Eraser className="size-3" aria-hidden />
            ) : (
              <MousePointerClick className="size-3" aria-hidden />
            )}
            {mode === 'remove'
              ? 'Click a place, device, backup, key or person to take it away. Wallets and paths explain themselves.'
              : 'Click a box to see what it needs and what this world does to it.'}
          </span>
          <span>Drag to move, scroll or pinch to zoom.</span>
          <span className="max-md:hidden">[ and ] step through worlds.</span>
        </p>
      </div>

      <Panel className="mt-4 p-4">
        {selected && mode === 'inspect' && graph ? (
          <NodeDetail
            plan={plan}
            graph={graph}
            report={report}
            node={selected}
            lens={lens}
            onEdit={edit}
            onClear={() => setSelectedId(null)}
          />
        ) : world ? (
          <WalletStanding
            plan={plan}
            world={world}
            onSelect={(id) => {
              setMode('inspect')
              setSelectedId(`wallet:${id}`)
            }}
          />
        ) : null}
        {graph ? (
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            <DiagramSummary graph={graph} />
            <DiagramOmissions graph={graph} narrowed={walletId !== null} />
            <Disclosure size="aside" title="What the drawing means">
              <DiagramLegend graph={graph} />
            </Disclosure>
            <Disclosure size="aside" title="Compose a situation by hand">
              <CustomScenario plan={plan} onChange={onComposed} />
            </Disclosure>
          </div>
        ) : null}
      </Panel>

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

function WorldChip({
  label,
  active,
  verdicts,
  onClick,
}: {
  label: string
  active: boolean
  verdicts?: { verdict: keyof typeof VERDICT; wallet: string }[]
  onClick: () => void
}) {
  const lost = verdicts?.filter((entry) => entry.verdict === 'lost').length ?? 0
  const taken = verdicts?.filter((entry) => entry.verdict === 'exposed').length ?? 0
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={verdicts
        ?.map((entry) => `${entry.wallet}: ${VERDICT[entry.verdict].label}`)
        .join(', ')}
      className={cn(
        'flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-accent bg-accent/10 font-medium text-strong'
          : 'border-line text-body hover:border-line-strong'
      )}
    >
      {verdicts ? (
        <span className="flex gap-[2px]" aria-hidden>
          {verdicts.slice(0, 5).map((entry, index) => (
            <span
              key={index}
              className={cn('size-1.5 rounded-[2px]', VERDICT[entry.verdict].tone)}
            />
          ))}
        </span>
      ) : null}
      {label}
      {/* The dots in words, for a reader who cannot see them. */}
      {verdicts ? (
        <span className="sr-only">
          {lost > 0 ? ` ${lost} unspendable.` : ''}
          {taken > 0 ? ` ${taken} theirs to spend.` : ''}
          {verdicts.map((entry) => ` ${entry.wallet}: ${VERDICT[entry.verdict].label}.`).join('')}
        </span>
      ) : null}
    </button>
  )
}
