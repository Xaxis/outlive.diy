/**
 * Where the diagram's boxes go.
 *
 * The engine says what depends on what; this says where to put it. It is a
 * layered layout: one column per dependency level, and within a column the
 * nodes are ordered so that the lines between columns cross as little as
 * possible. That ordering is the whole job. A correct diagram whose edges
 * cross forty times is one nobody reads, and an unread diagram is the same as
 * no diagram.
 *
 * Crossing reduction is the classic barycentre heuristic: put each node beside
 * the average position of the things it connects to, sweep forwards, sweep
 * backwards, repeat. It is not optimal, and optimal is NP-hard, but it is
 * stable and it converges in four passes on the sizes a custody plan reaches.
 *
 * This lives in the app rather than in the engine because it is arithmetic
 * about pixels. What relates to what is a question about custody; where it sits
 * on a screen is not.
 */

import type { GraphEdge, GraphNode, PlanGraph } from '@outlive/core'

export const NODE_WIDTH = 140
export const NODE_HEIGHT = 46
/** Vertical space between two boxes in the same column. */
export const ROW_GAP = 10
/**
 * Horizontal space between columns, which is where the edges are drawn. Six
 * columns at this width and gap come to 1080px, which is what the content
 * column holds at the width most people read this at. Wider than that and the
 * people column falls off the right-hand edge of every screenshot.
 */
export const COLUMN_GAP = 48
/** Room at the top for the column headings. */
export const HEADER_HEIGHT = 26
export const PADDING = 8

export interface PlacedNode extends GraphNode {
  x: number
  y: number
  /** Position of this node's column on screen, not its dependency level. */
  column: number
}

export interface PlacedEdge extends GraphEdge {
  /** An SVG path, already in diagram coordinates. */
  path: string
  /** Where a label sits, when the edge has one. */
  labelX: number
  labelY: number
}

export interface Layout {
  nodes: PlacedNode[]
  edges: PlacedEdge[]
  /** One entry per drawn column, with the x it starts at. */
  columns: { layer: number; x: number }[]
  width: number
  height: number
}

const PASSES = 4

/**
 * Mean index of a node's neighbours in an adjacent column. Returns null when it
 * has none, which means "stay where you are" rather than "go to the top".
 */
function barycentre(ids: string[], positions: Map<string, number>): number | null {
  const known = ids
    .map((id) => positions.get(id))
    .filter((value): value is number => value !== undefined)
  if (known.length === 0) return null
  return known.reduce((total, value) => total + value, 0) / known.length
}

export function layoutGraph(graph: PlanGraph): Layout {
  const layers = graph.layers
  const byLayer = new Map<number, GraphNode[]>()
  for (const layer of layers) {
    byLayer.set(
      layer,
      graph.nodes.filter((node) => node.layer === layer)
    )
  }

  const predecessors = new Map<string, string[]>()
  const successors = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (!successors.has(edge.from)) successors.set(edge.from, [])
    successors.get(edge.from)!.push(edge.to)
    if (!predecessors.has(edge.to)) predecessors.set(edge.to, [])
    predecessors.get(edge.to)!.push(edge.from)
  }

  const indexIn = (layer: number) => {
    const positions = new Map<string, number>()
    byLayer.get(layer)?.forEach((node, index) => positions.set(node.id, index))
    return positions
  }

  const sweep = (
    order: number[],
    neighbours: Map<string, string[]>,
    from: (i: number) => number
  ) => {
    for (const position of order) {
      const layer = layers[position]
      const reference = indexIn(layers[from(position)])
      const nodes = byLayer.get(layer)
      if (!nodes) continue
      const scores = new Map<string, number>()
      nodes.forEach((node, index) => {
        const mean = barycentre(neighbours.get(node.id) ?? [], reference)
        scores.set(node.id, mean ?? index)
      })
      // A stable sort keeps nodes with equal scores in the order the engine
      // emitted them, which is grouped by the thing they hang off.
      byLayer.set(
        layer,
        [...nodes].sort((a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0))
      )
    }
  }

  const forward = layers.map((_, index) => index).slice(1)
  const backward = layers
    .map((_, index) => index)
    .slice(0, -1)
    .reverse()
  for (let pass = 0; pass < PASSES; pass += 1) {
    sweep(forward, predecessors, (i) => i - 1)
    sweep(backward, successors, (i) => i + 1)
  }

  const columns = layers.map((layer, index) => ({
    layer,
    x: PADDING + index * (NODE_WIDTH + COLUMN_GAP),
  }))

  const placed: PlacedNode[] = []
  layers.forEach((layer, index) => {
    const nodes = byLayer.get(layer) ?? []
    nodes.forEach((node, row) => {
      placed.push({
        ...node,
        column: index,
        x: columns[index].x,
        y: PADDING + HEADER_HEIGHT + row * (NODE_HEIGHT + ROW_GAP),
      })
    })
  })

  const positions = new Map(placed.map((node) => [node.id, node]))
  const tallest = layers.reduce((most, layer) => Math.max(most, byLayer.get(layer)?.length ?? 0), 0)

  // Centre every column against the tallest one. Without this a column with two
  // boxes sits at the top beside a column with nine, and the eye reads the gap
  // as meaning something.
  for (const node of placed) {
    const count = byLayer.get(layers[node.column])?.length ?? 0
    node.y += ((tallest - count) * (NODE_HEIGHT + ROW_GAP)) / 2
  }

  const edges: PlacedEdge[] = []
  for (const edge of graph.edges) {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    if (!from || !to) continue
    const x1 = from.x + NODE_WIDTH
    const y1 = from.y + NODE_HEIGHT / 2
    const x2 = to.x
    const y2 = to.y + NODE_HEIGHT / 2
    const bend = Math.max(18, (x2 - x1) / 2)
    edges.push({
      ...edge,
      path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2 - 5,
    })
  }

  const width = PADDING * 2 + layers.length * NODE_WIDTH + (layers.length - 1) * COLUMN_GAP
  const height = PADDING * 2 + HEADER_HEIGHT + tallest * NODE_HEIGHT + (tallest - 1) * ROW_GAP

  return { nodes: placed, edges, columns, width, height: Math.max(height, 120) }
}

/** Every node reachable from one node, in either direction. The trace on hover. */
export function connectedTo(graph: PlanGraph, nodeId: string): Set<string> {
  const out = new Set<string>([nodeId])
  const down = new Map<string, string[]>()
  const up = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (!down.has(edge.from)) down.set(edge.from, [])
    down.get(edge.from)!.push(edge.to)
    if (!up.has(edge.to)) up.set(edge.to, [])
    up.get(edge.to)!.push(edge.from)
  }
  const walk = (id: string, map: Map<string, string[]>) => {
    for (const next of map.get(id) ?? []) {
      if (out.has(next)) continue
      out.add(next)
      walk(next, map)
    }
  }
  walk(nodeId, down)
  walk(nodeId, up)
  return out
}
