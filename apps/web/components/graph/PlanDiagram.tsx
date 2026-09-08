'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleDot,
  FileKey2,
  KeyRound,
  Lock,
  MapPin,
  Puzzle,
  ShieldEllipsis,
  Split,
  User,
  Wallet as WalletIcon,
} from 'lucide-react'
import type { GraphNodeKind, PlanGraph, Ref } from '@outlive/core'
import { LAYER_LABELS } from '@outlive/core'
import {
  connectedTo,
  layoutGraph,
  COLUMN_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  HEADER_HEIGHT,
  PADDING,
} from '@/lib/graph-layout.ts'
import { cn } from '@/lib/cn.ts'

const ICON: Record<GraphNodeKind, typeof KeyRound> = {
  wallet: WalletIcon,
  path: Split,
  config: FileKey2,
  key: KeyRound,
  device: CircleDot,
  backup: KeyRound,
  share: Puzzle,
  passphrase: ShieldEllipsis,
  pin: Lock,
  place: MapPin,
  person: User,
}

const KIND_NOUN: Record<GraphNodeKind, string> = {
  wallet: 'wallet',
  path: 'spend path',
  config: 'wallet configuration',
  key: 'key',
  device: 'signing device',
  backup: 'backup',
  share: 'backup share',
  passphrase: 'passphrase',
  pin: 'PIN',
  place: 'place',
  person: 'person',
}

/**
 * The plan, drawn.
 *
 * Boxes are real DOM, positioned absolutely; only the edges are SVG. Doing it
 * the other way round would mean reimplementing focus, hover, truncation and
 * icons inside a drawing surface, and would leave a screen reader with a
 * picture of a custody plan and nothing to read.
 *
 * The colouring inverts with the actor, and it has to. When the question is
 * whether you can recover, a box you cannot reach is the failure. When the
 * question is what somebody standing in one room can take, a box they *can*
 * reach is the failure, and painting their empty hands red would be telling the
 * reader that good news is bad. So: reachable-and-yours is neutral, out of your
 * reach is a loss, in their reach is a taking, and out of their reach is
 * quietly not part of the story.
 *
 * Nothing here is carried by colour on its own. A loss is dashed and captioned
 * with the reason; a taking is solid and captioned with what it gives.
 */

/** How many rows the written summary prints before it starts counting. */
const LIST_LIMIT = 12

/**
 * How far the diagram will shrink to fit its column before it gives up and
 * scrolls instead. Below this the labels stop being readable, and an unreadable
 * diagram that fits is worse than a readable one you have to push sideways.
 *
 * Three quarters puts the smallest text at about nine pixels, which is the
 * floor. On a phone this means the diagram scrolls, which is what a diagram on
 * a phone should do.
 */
const MIN_SCALE = 0.75

/**
 * Scale the drawing down to whatever room it has been given, never up.
 *
 * The same diagram appears in a full-width view and in a column beside a rail,
 * and the second one would otherwise be a picture with its last two columns cut
 * off, which reads as broken rather than as scrollable.
 */
function useFitScale(width: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const available = element.clientWidth
      if (available <= 0) return
      setScale(Math.min(1, Math.max(MIN_SCALE, available / width)))
    }
    measure()
    // Not every environment this renders in has a ResizeObserver, and the test
    // environment is one of them. Falling back to the window keeps the initial
    // measurement, which is the one that matters.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width])

  return [ref, scale]
}

type Tone = 'normal' | 'lost' | 'taken' | 'idle'

const TONE_BOX: Record<Tone, string> = {
  normal: 'border-line-strong bg-raised',
  lost: 'border-dashed border-critical/45 bg-critical/[0.05]',
  taken: 'border-critical bg-critical/10',
  idle: 'border-dashed border-line bg-transparent',
}

const TONE_ICON: Record<Tone, string> = {
  normal: 'text-accent',
  lost: 'text-critical',
  taken: 'text-critical',
  idle: 'text-faint',
}

const TONE_LABEL: Record<Tone, string> = {
  normal: 'text-strong',
  lost: 'text-muted',
  taken: 'text-strong',
  idle: 'text-muted',
}

const TONE_DETAIL: Record<Tone, string> = {
  normal: 'text-faint',
  lost: 'text-critical',
  taken: 'text-critical',
  idle: 'text-faint',
}

export function PlanDiagram({
  graph,
  onSelect,
  onSelectNode,
  selectedId,
  className,
  maxHeight,
}: {
  graph: PlanGraph
  /** Clicking a box hands back what it stands for. For jumping somewhere. */
  onSelect?: (ref: Ref) => void
  /**
   * Clicking a box hands back the box. For staying here: the map answers about
   * the node itself, including the ones that stand for no single entity.
   */
  onSelectNode?: (id: string) => void
  selectedId?: string | null
  className?: string
  /**
   * A ceiling for the drawing where it shares a page with other things. A big
   * plan makes a very tall column, and a summary screen should not become four
   * thousand pixels of diagram. It scrolls rather than being cropped: hiding
   * part of a dependency graph is how a reader concludes the wrong thing.
   */
  maxHeight?: number
}) {
  const layout = useMemo(() => layoutGraph(graph), [graph])
  const [outer, scale] = useFitScale(layout.width)
  const [focused, setFocused] = useState<string | null>(null)
  // Hovering traces a chain; a selection holds one. Without the second, moving
  // the mouse away from a box you just clicked unlights the very thing the
  // panel underneath is describing.
  const traced = focused ?? selectedId ?? null
  const lit = useMemo(() => (traced ? connectedTo(graph, traced) : null), [graph, traced])
  // A hover is a flick and can dim hard. A selection is held for as long as the
  // reader is reading the panel underneath, and a page left at a quarter
  // opacity for that long reads as broken rather than as backgrounded.
  const dimmed = focused ? 0.2 : 0.45
  const adversary = graph.world.actor === 'adversary'

  if (layout.nodes.length === 0) return null

  return (
    <div
      ref={outer}
      className={cn('overflow-x-auto', maxHeight && 'overflow-y-auto', className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <div
        className="relative select-none"
        style={{
          width: layout.width,
          height: layout.height,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          // The box the drawing occupies has to shrink with it, or the panel
          // keeps the unscaled height and gains a band of empty space.
          marginBottom: scale < 1 ? layout.height * (scale - 1) : undefined,
          marginRight: scale < 1 ? layout.width * (scale - 1) : undefined,
        }}
        onMouseLeave={() => setFocused(null)}
      >
        <svg
          width={layout.width}
          height={layout.height}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          {layout.edges.map((edge) => {
            const dim = lit !== null && !(lit.has(edge.from) && lit.has(edge.to))
            return (
              <g key={edge.id} opacity={dim ? dimmed * 0.5 : 1}>
                <path
                  d={edge.path}
                  fill="none"
                  // Live-and-yours is neutral; anything else is the failure.
                  // The two halves of that swap with the actor, exactly as the
                  // boxes do.
                  stroke={edge.live !== adversary ? 'var(--c-line-strong)' : 'var(--c-critical)'}
                  strokeWidth={edge.live ? 1.25 : 1}
                  strokeDasharray={edge.live ? undefined : '3 3'}
                  opacity={edge.live ? 0.85 : 0.45}
                />
              </g>
            )
          })}
        </svg>

        {layout.columns.map((column) => (
          <p
            key={column.layer}
            className="eyebrow absolute truncate"
            style={{ left: column.x, top: PADDING, width: NODE_WIDTH }}
          >
            {LAYER_LABELS[column.layer]}
          </p>
        ))}

        {layout.nodes.map((node) => {
          const Icon = ICON[node.kind]
          const dim = lit !== null && !lit.has(node.id)
          const tone: Tone = adversary
            ? node.available
              ? 'taken'
              : 'idle'
            : node.available
              ? 'normal'
              : 'lost'
          const interactive = Boolean(onSelectNode || (node.ref && onSelect))
          const state = adversary
            ? node.available
              ? 'They have this.'
              : `Out of their reach: ${node.blocker ?? 'not where they are'}.`
            : node.available
              ? 'Within reach.'
              : `Not available: ${node.blocker ?? 'out of reach'}.`
          return (
            <button
              key={node.id}
              type="button"
              disabled={!interactive}
              onMouseEnter={() => setFocused(node.id)}
              onFocus={() => setFocused(node.id)}
              onBlur={() => setFocused(null)}
              onClick={() => {
                if (onSelectNode) onSelectNode(node.id)
                else if (node.ref) onSelect?.(node.ref)
              }}
              // Every box is narrower than some of the labels it has to carry,
              // so the whole of it is also the tooltip.
              title={`${node.label}${node.detail ? ` (${node.detail})` : ''}. ${state}`}
              className={cn(
                'absolute flex flex-col justify-center gap-0.5 rounded-[var(--radius-control)] border px-2.5 text-left transition-opacity',
                'disabled:cursor-default',
                interactive && 'hover:border-accent',
                TONE_BOX[tone],
                selectedId === node.id && 'border-accent ring-1 ring-accent'
              )}
              style={{
                left: node.x,
                top: node.y,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                opacity: dim ? dimmed : 1,
              }}
            >
              <span className="flex items-center gap-1.5">
                <Icon className={cn('size-3.5 flex-none', TONE_ICON[tone])} aria-hidden />
                <span
                  className={cn(
                    'truncate text-[0.78rem] font-medium leading-tight',
                    TONE_LABEL[tone]
                  )}
                >
                  {node.label}
                </span>
              </span>
              <span className={cn('truncate text-[0.65rem] leading-tight', TONE_DETAIL[tone])}>
                {/* On a box this size the reason is worth more room than the
                    description, so where there is a reason it takes the line. */}
                {tone === 'lost'
                  ? (node.blocker ?? 'out of reach')
                  : (node.detail ?? KIND_NOUN[node.kind])}
              </span>
              <span className="sr-only">
                {KIND_NOUN[node.kind]}. {state}
              </span>
            </button>
          )
        })}

        {layout.edges
          .filter((edge) => edge.label)
          .map((edge) => (
            <span
              key={`${edge.id}-label`}
              title={edge.label ?? undefined}
              className="pointer-events-none absolute -translate-x-1/2 truncate rounded bg-canvas px-1 text-[0.6rem] leading-tight text-faint"
              style={{
                left: edge.labelX,
                top: edge.labelY - 6,
                maxWidth: COLUMN_GAP + 16,
                opacity:
                  lit !== null && !(lit.has(edge.from) && lit.has(edge.to)) ? dimmed * 0.5 : 1,
              }}
            >
              {edge.label}
            </span>
          ))}
      </div>
    </div>
  )
}

/**
 * The same information as a list, for a screen reader and for print. The
 * diagram is aria-hidden's opposite: it is readable, but reading a graph by
 * tabbing through 40 boxes is not how anybody wants to learn what depends on
 * what.
 */
export function DiagramSummary({ graph }: { graph: PlanGraph }) {
  // Same inversion as the drawing. In an adversary world the list worth
  // reading is what they got, not the much longer list of what they did not.
  const adversary = graph.world.actor === 'adversary'
  const blocked = graph.nodes.filter((node) => node.available === adversary)
  if (blocked.length === 0) {
    return (
      <p className="text-xs text-muted">
        {adversary
          ? 'Nothing in this plan is within their reach here.'
          : 'Everything this plan depends on is within reach in this world.'}
      </p>
    )
  }
  return (
    <div className="text-xs text-muted">
      <p className="mb-1">{adversary ? 'What they can reach:' : 'Out of reach here:'}</p>
      <ul className="grid gap-0.5">
        {blocked.slice(0, LIST_LIMIT).map((node) => (
          <li key={node.id}>
            <span className="text-body">{node.label}</span>
            <span className="text-faint"> ({KIND_NOUN[node.kind]})</span>
            {!adversary && node.blocker ? (
              <span className="text-faint"> {node.blocker}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {blocked.length > LIST_LIMIT ? (
        <p className="mt-1 text-faint">and {blocked.length - LIST_LIMIT} more.</p>
      ) : null}
    </div>
  )
}

/**
 * What the drawing means, in the terms of the world it is drawn in. One
 * sentence, and it has to change with the actor for the same reason the colours
 * do.
 */
export function DiagramLegend({ graph }: { graph: PlanGraph }) {
  const adversary = graph.world.actor === 'adversary'
  return (
    <p className="text-xs leading-relaxed text-faint">
      Each box needs the boxes to its right.{' '}
      {adversary
        ? 'A solid red box is one they hold in this world; a faint dashed box is out of their reach and out of the story.'
        : 'A dashed red box cannot be reached in this world, and the line into it is dashed too.'}{' '}
      Hovering a box lights the chain it belongs to; clicking one holds that chain and says what
      this world does to it.
    </p>
  )
}

export { HEADER_HEIGHT }
