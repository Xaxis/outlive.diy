'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  CircleDot,
  Crosshair,
  FileKey2,
  KeyRound,
  Lock,
  MapPin,
  Minus,
  Plus,
  Puzzle,
  RotateCcw,
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
  PADDING,
  ROW_GAP,
  type ColumnOrders,
  type PlacedNode,
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
 * The plan, drawn, on a surface you can move around in.
 *
 * This was a fixed picture that shrank until it fitted whatever column it was
 * given. That is fine for a thumbnail and useless for the thing it is meant to
 * be: a plan with forty keys became a wall of nine-pixel text, and the only way
 * to read a corner of it was to read all of it at once. So the drawing now sits
 * in a viewport. Drag to move, wheel or pinch to zoom, and the controls in the
 * corner say where you are and put you back.
 *
 * What you cannot do is drag a box somewhere else, and that is deliberate. The
 * column a box sits in *is* information: wallets, then what they need, then
 * keys, then the material a key exists as, then places, then people. A box
 * dragged out of its column would say something false about the plan, and a
 * diagram that can be made to lie is worse than one that cannot be rearranged.
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

const MIN_SCALE = 0.3
const MAX_SCALE = 2
/**
 * How small a fit is allowed to make the drawing.
 *
 * Fitting the whole width is the right answer on a screen wide enough to read
 * the result. On a phone it is not: a plan a thousand pixels wide fitted into
 * three hundred is a picture of a custody plan at three tenths, which is a grey
 * smear with a zoom control on it. Below this the fit stops shrinking and the
 * surface is panned instead, which is what a surface is for.
 */
const MIN_FIT_SCALE = 0.6
/** Room left around the drawing when it is fitted to the viewport. */
const FIT_PADDING = 20
/** How far a press has to travel before it is a drag rather than a click. */
const DRAG_THRESHOLD = 4
/** How far one arrow key moves the surface, and one press of a zoom button. */
const PAN_STEP = 48
const ZOOM_STEP = 1.25

interface View {
  x: number
  y: number
  scale: number
}

/** There is no paint to be ahead of while the document is being generated. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Zoom about a point, so that whatever is under the pointer stays under it.
 * Zooming about the origin instead sends the thing you were looking at off the
 * edge, which is why every map in the world does it this way.
 */
function zoomAbout(view: View, scale: number, px: number, py: number): View {
  const next = clamp(scale, MIN_SCALE, MAX_SCALE)
  const ratio = next / view.scale
  return { scale: next, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }
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
  height = '26rem',
  minHeight,
  onHeight,
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
   * How tall the viewport is, as a CSS length. The drawing inside it is
   * whatever size it is; this is the window onto it. On the map that window is
   * most of the screen, and on a summary panel it is a band. It is a ceiling:
   * the surface is never taller than the drawing needs.
   */
  height?: string
  /**
   * A floor, for a caller that has already decided how tall the surface is.
   * The map sizes the drawing and the list beside it together, and a surface
   * that then shrank out from under the list would leave the two columns
   * ending in different places.
   */
  minHeight?: string
  /**
   * The height the drawing actually needs at the width it has been given, so
   * that whatever sits beside the surface can be the same height as it.
   */
  onHeight?: (px: number) => void
}) {
  // Row order for any column the reader has rearranged by hand. Held here and
  // not in the plan file: where a box sits on a screen is not a fact about
  // custody, and a plan handed to somebody else should arrive in the order the
  // layout argues for rather than the order somebody once dragged it into.
  const [orders, setOrders] = useState<ColumnOrders>(() => new Map())
  const layout = useMemo(() => layoutGraph(graph, orders), [graph, orders])
  const viewport = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 })
  const [available, setAvailable] = useState(0)
  const [panning, setPanning] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)

  // Whether the reader has moved the surface themselves. If they have, a change
  // in the surface's height alone leaves it exactly where they put it: a
  // diagram that jumps back to the middle because a panel below it opened is a
  // diagram fighting its reader. A change in width is different, because the
  // scale the whole drawing fits at is derived from the width, so the old
  // position means nothing against the new one.
  const moved = useRef(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
  // A press on a box is a click until it has moved far enough to be a drag,
  // and once it has, the click that follows the release is not one.
  const grab = useRef<{ id: string; y: number; moved: boolean } | null>(null)

  // How tall the drawing needs the surface to be. Only the width matters here:
  // it decides the scale at which the whole drawing fits across, and therefore
  // how tall it is at that scale. Taking the height into account as well would
  // make the height depend on itself.
  const natural =
    available > 0
      ? Math.ceil(
          layout.height * clamp((available - FIT_PADDING * 2) / layout.width, MIN_FIT_SCALE, 1) +
            FIT_PADDING * 2
        )
      : null

  // Depends on the measured width because the surface's own height is derived
  // from it: when the width changes the height changes on the next commit, and
  // the fit has to be recomputed against the new one rather than the one it was
  // last centred in.
  const fit = useCallback(() => {
    const element = viewport.current
    if (!element) return
    const width = available || element.clientWidth
    const height = element.clientHeight
    if (width <= 0 || height <= 0) return
    // Never magnified past life size on a fit. A four-box plan blown up to fill
    // a wall looks like an error rather than like a small plan.
    const scale = clamp(
      Math.min(
        (width - FIT_PADDING * 2) / layout.width,
        (height - FIT_PADDING * 2) / layout.height,
        1
      ),
      MIN_FIT_SCALE,
      1
    )
    moved.current = false
    setView({
      scale,
      x: (width - layout.width * scale) / 2,
      y: (height - layout.height * scale) / 2,
    })
  }, [layout.width, layout.height, available])

  // Before paint, so the drawing is never seen at the wrong scale for a frame.
  // A layout effect during the static render would only warn that it does
  // nothing there, which is true and not worth saying every build.
  useIsomorphicLayoutEffect(fit, [fit])

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const refit = () => {
      setAvailable(element.clientWidth)
      if (!moved.current) fit()
    }
    refit()
    // Not every environment this renders in has a ResizeObserver, and the test
    // environment is one of them.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', refit)
      return () => window.removeEventListener('resize', refit)
    }
    const observer = new ResizeObserver(refit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fit])

  useEffect(() => {
    if (natural !== null) onHeight?.(natural)
  }, [natural, onHeight])

  // A wheel over the drawing zooms rather than scrolling the page past it,
  // which needs preventDefault, which needs a listener React cannot give us:
  // it registers wheel as passive.
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      moved.current = true
      const rect = element.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      setView((current) =>
        zoomAbout(current, current.scale * Math.exp(-event.deltaY * 0.0015), px, py)
      )
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  const zoomBy = (factor: number) => {
    const element = viewport.current
    if (!element) return
    moved.current = true
    setView((current) =>
      zoomAbout(current, current.scale * factor, element.clientWidth / 2, element.clientHeight / 2)
    )
  }

  const nudge = (dx: number, dy: number) => {
    moved.current = true
    setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }))
  }

  /**
   * Bring a box into the window. Tabbing through forty nodes is only navigation
   * if the one with focus is on screen; without this the focus ring spends most
   * of its time outside the viewport and the reader is looking at nothing.
   */
  const reveal = (node: PlacedNode) => {
    const element = viewport.current
    if (!element) return
    setView((current) => {
      const left = node.x * current.scale + current.x
      const top = node.y * current.scale + current.y
      const right = left + NODE_WIDTH * current.scale
      const bottom = top + NODE_HEIGHT * current.scale
      const margin = 24
      let dx = 0
      let dy = 0
      if (left < margin) dx = margin - left
      else if (right > element.clientWidth - margin) dx = element.clientWidth - margin - right
      if (top < margin) dy = margin - top
      else if (bottom > element.clientHeight - margin) dy = element.clientHeight - margin - bottom
      if (dx === 0 && dy === 0) return current
      moved.current = true
      return { ...current, x: current.x + dx, y: current.y + dy }
    })
  }

  /**
   * Put one box at a given row inside its own column.
   *
   * Only inside its own column, and that is the whole design. The column a box
   * sits in is what kind of thing it is: wallets, then what they need, then
   * keys, then the material a key exists as, then places, then people. A box
   * dragged across that boundary would state something false about the plan,
   * and a drawing that can be made to lie is worse than one that cannot be
   * rearranged. Up and down says nothing false, and is how a reader untangles
   * one corner of a plan with forty keys in it.
   */
  const reorder = (node: PlacedNode, to: number) => {
    const column = layout.nodes
      .filter((entry) => entry.layer === node.layer)
      .sort((a, b) => a.y - b.y)
    const ids = column.map((entry) => entry.id)
    const from = ids.indexOf(node.id)
    const target = clamp(to, 0, ids.length - 1)
    if (from < 0 || from === target) return
    ids.splice(target, 0, ids.splice(from, 1)[0])
    setOrders((current) => new Map(current).set(node.layer, ids))
  }

  const rowOf = (node: PlacedNode) =>
    layout.nodes
      .filter((entry) => entry.layer === node.layer)
      .sort((a, b) => a.y - b.y)
      .findIndex((entry) => entry.id === node.id)

  /** Which row a pointer is over, in the column the drag started in. */
  const rowUnder = (node: PlacedNode, clientY: number) => {
    const element = viewport.current
    if (!element) return rowOf(node)
    const top = layout.nodes
      .filter((entry) => entry.layer === node.layer)
      .reduce((least, entry) => Math.min(least, entry.y), Number.MAX_SAFE_INTEGER)
    const stageY = (clientY - element.getBoundingClientRect().top - view.y) / view.scale
    return Math.round((stageY - top - NODE_HEIGHT / 2) / (NODE_HEIGHT + ROW_GAP))
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // A press that lands on a box is a click on that box, not a drag of the
    // surface underneath it.
    //
    // The capture call is optional because the environment the tests run in has
    // no pointer capture, and nothing there is dragged far enough to need it.
    if ((event.target as HTMLElement).closest('[data-node]')) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) pinch.current = null
    setPanning(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = pointers.current
    const previous = held.get(event.pointerId)
    if (!previous) return
    held.set(event.pointerId, { x: event.clientX, y: event.clientY })
    moved.current = true
    if (held.size === 1) {
      nudge(event.clientX - previous.x, event.clientY - previous.y)
      return
    }
    // Two fingers: the distance between them is the scale, and the point
    // between them is what stays still.
    const [a, b] = [...held.values()]
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    const rect = event.currentTarget.getBoundingClientRect()
    const cx = (a.x + b.x) / 2 - rect.left
    const cy = (a.y + b.y) / 2 - rect.top
    if (pinch.current) {
      const factor = distance / pinch.current
      setView((current) => zoomAbout(current, current.scale * factor, cx, cy))
    }
    pinch.current = distance
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) setPanning(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? PAN_STEP * 3 : PAN_STEP
    switch (event.key) {
      case 'ArrowLeft':
        nudge(step, 0)
        break
      case 'ArrowRight':
        nudge(-step, 0)
        break
      case 'ArrowUp':
        nudge(0, step)
        break
      case 'ArrowDown':
        nudge(0, -step)
        break
      case '+':
      case '=':
        zoomBy(ZOOM_STEP)
        break
      case '-':
      case '_':
        zoomBy(1 / ZOOM_STEP)
        break
      case '0':
        fit()
        break
      default:
        return
    }
    event.preventDefault()
  }

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
      className={cn(
        'plan-canvas relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken',
        className
      )}
      // The height given is a ceiling, not a demand. A plan with six boxes in a
      // window with room for sixty leaves a field of empty grey under a small
      // drawing, which reads as something failing to load. So the surface is
      // never taller than the drawing needs at the width it has got, and never
      // shorter than a caller sizing the page around it has asked for.
      style={{
        height: natural === null ? height : `clamp(${minHeight ?? '0px'}, ${natural}px, ${height})`,
      }}
    >
      <div
        ref={viewport}
        tabIndex={0}
        role="group"
        aria-label="The plan, drawn. Drag the background to move it, arrow keys to pan, plus and minus to zoom. Drag a box, or hold alt and press up or down, to move it within its column."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          // The background, not a box: double-clicking a box is two clicks on
          // it, and refitting the surface underneath is not what was asked for.
          if (!(event.target as HTMLElement).closest('[data-node]')) fit()
        }}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setFocused(null)}
        className={cn(
          'plan-canvas-viewport absolute inset-0 touch-none outline-none',
          'focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset',
          panning ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div
          className="plan-canvas-stage absolute left-0 top-0 select-none"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
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
                    // The two halves of that swap with the actor, exactly as
                    // the boxes do.
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
            const moving = dragging === node.id
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
                data-node
                disabled={!interactive}
                onPointerDown={(event) => {
                  if (!interactive) return
                  event.currentTarget.setPointerCapture?.(event.pointerId)
                  grab.current = { id: node.id, y: event.clientY, moved: false }
                }}
                onPointerMove={(event) => {
                  const held = grab.current
                  if (!held || held.id !== node.id) return
                  if (!held.moved && Math.abs(event.clientY - held.y) < DRAG_THRESHOLD) return
                  held.moved = true
                  setDragging(node.id)
                  reorder(node, rowUnder(node, event.clientY))
                }}
                onPointerUp={() => {
                  grab.current = null
                  setDragging(null)
                }}
                onPointerCancel={() => {
                  grab.current = null
                  setDragging(null)
                }}
                onKeyDown={(event) => {
                  // The same move from the keyboard. A drag is the only way to
                  // do this otherwise, and a drag is not a way at all for
                  // somebody who is not using a pointer.
                  if (!event.altKey) return
                  const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
                  if (delta === 0) return
                  event.preventDefault()
                  // Or the surface underneath would pan as well.
                  event.stopPropagation()
                  reorder(node, rowOf(node) + delta)
                }}
                onMouseEnter={() => setFocused(node.id)}
                onFocus={(event) => {
                  setFocused(node.id)
                  // Only chase focus that arrived by keyboard. Panning the
                  // surface under a mouse that has just clicked something is a
                  // fight with the reader's hand.
                  try {
                    if (event.currentTarget.matches(':focus-visible')) reveal(node)
                  } catch {
                    // A browser or test environment without :focus-visible.
                  }
                }}
                onBlur={() => setFocused(null)}
                onClick={() => {
                  // The release at the end of a drag also fires a click, and a
                  // box the reader has just moved is not a box they asked to
                  // open.
                  if (moving) return
                  if (onSelectNode) onSelectNode(node.id)
                  else if (node.ref) onSelect?.(node.ref)
                }}
                // Every box is narrower than some of the labels it has to
                // carry, so the whole of it is also the tooltip.
                title={`${node.label}${node.detail ? ` (${node.detail})` : ''}. ${state}`}
                className={cn(
                  'absolute flex flex-col justify-center gap-0.5 rounded-[var(--radius-control)] border px-2.5 text-left',
                  'disabled:cursor-default',
                  // Not while it is being moved: a box animating its opacity
                  // under a finger that is dragging it lags behind the finger.
                  moving ? 'z-10 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.7)]' : 'transition-opacity',
                  interactive && 'cursor-grab active:cursor-grabbing hover:border-accent',
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
                className="pointer-events-none absolute -translate-x-1/2 truncate rounded bg-sunken px-1 text-[0.6rem] leading-tight text-faint"
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

      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface/90 p-1 backdrop-blur no-print">
        <CanvasButton label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <Minus className="size-3.5" aria-hidden />
        </CanvasButton>
        <span className="mono w-11 text-center text-[0.6875rem] tabular-nums text-faint">
          {Math.round(view.scale * 100)}%
        </span>
        <CanvasButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
          <Plus className="size-3.5" aria-hidden />
        </CanvasButton>
        <CanvasButton label="Fit the whole plan" onClick={fit}>
          <Crosshair className="size-3.5" aria-hidden />
        </CanvasButton>
        {/* Only once something has been moved. A control for undoing a thing
            nobody has done is a control that has to be read and dismissed. */}
        {orders.size > 0 ? (
          <CanvasButton label="Put the boxes back in order" onClick={() => setOrders(new Map())}>
            <RotateCcw className="size-3.5" aria-hidden />
          </CanvasButton>
        ) : null}
      </div>
    </div>
  )
}

function CanvasButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-[rgb(var(--tint)/0.07)] hover:text-strong"
    >
      {children}
    </button>
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
      this world does to it. Drag the background to move the surface, scroll or pinch to zoom, and
      double-click it to fit the whole plan again. A box can be dragged up or down within its own
      column, and not out of it: which column it is in is what kind of thing it is.
    </p>
  )
}
