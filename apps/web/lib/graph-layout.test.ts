import { describe, expect, it } from 'vitest'
import {
  baseWorld,
  buildGraph,
  createBackup,
  createConfigBackup,
  createDevice,
  createKey,
  createLocation,
  createPlan,
  createSpendPath,
  createWallet,
  without,
} from '@outlive/core'
import { connectedTo, layoutGraph, NODE_HEIGHT, NODE_WIDTH, ROW_GAP } from './graph-layout.ts'

function plan() {
  return createPlan({
    locations: [
      createLocation({ id: 'a', label: 'Site A' }),
      createLocation({ id: 'b', label: 'Site B' }),
      createLocation({ id: 'c', label: 'Site C' }),
    ],
    devices: [
      createDevice({ id: 'd1', label: 'Signer A' }),
      createDevice({ id: 'd2', label: 'Signer B' }),
      createDevice({ id: 'd3', label: 'Signer C' }),
    ],
    keys: [
      createKey({
        id: 'k1',
        label: 'Key A',
        deviceId: 'd1',
        deviceLocationId: 'a',
        backups: [createBackup({ id: 'b1', locationId: 'a' })],
      }),
      createKey({
        id: 'k2',
        label: 'Key B',
        deviceId: 'd2',
        deviceLocationId: 'b',
        backups: [createBackup({ id: 'b2', locationId: 'b' })],
      }),
      createKey({
        id: 'k3',
        label: 'Key C',
        deviceId: 'd3',
        deviceLocationId: 'c',
        backups: [createBackup({ id: 'b3', locationId: 'c' })],
      }),
    ],
    wallets: [
      createWallet({
        id: 'w',
        label: 'Vault',
        paths: [createSpendPath({ id: 'p', threshold: 2, keyIds: ['k1', 'k2', 'k3'] })],
        configBackups: [createConfigBackup({ id: 'cfg', locationId: 'a' })],
      }),
    ],
  })
}

/** Edges crossing, counted pairwise within each gap between two columns. */
function crossings(layout: ReturnType<typeof layoutGraph>): number {
  const y = new Map(layout.nodes.map((node) => [node.id, node.y]))
  const column = new Map(layout.nodes.map((node) => [node.id, node.column]))
  let total = 0
  for (let i = 0; i < layout.edges.length; i += 1) {
    for (let j = i + 1; j < layout.edges.length; j += 1) {
      const a = layout.edges[i]
      const b = layout.edges[j]
      if (column.get(a.from) !== column.get(b.from)) continue
      if (column.get(a.to) !== column.get(b.to)) continue
      const a1 = y.get(a.from)!
      const a2 = y.get(a.to)!
      const b1 = y.get(b.from)!
      const b2 = y.get(b.to)!
      if ((a1 - b1) * (a2 - b2) < 0) total += 1
    }
  }
  return total
}

describe('the diagram layout', () => {
  it('puts one column per dependency level, in order', () => {
    const p = plan()
    const layout = layoutGraph(buildGraph(p, baseWorld(p)))
    const columns = [...new Set(layout.nodes.map((node) => node.column))].sort((a, b) => a - b)
    expect(columns).toEqual([0, 1, 2, 3, 4])
    const x = new Map(layout.nodes.map((node) => [node.id, node.x]))
    expect(x.get('wallet:w')!).toBeLessThan(x.get('key:k1')!)
    expect(x.get('key:k1')!).toBeLessThan(x.get('place:a')!)
  })

  it('never overlaps two boxes in the same column', () => {
    const p = plan()
    const layout = layoutGraph(buildGraph(p, baseWorld(p)))
    for (const column of new Set(layout.nodes.map((node) => node.column))) {
      const ys = layout.nodes
        .filter((node) => node.column === column)
        .map((node) => node.y)
        .sort((a, b) => a - b)
      for (let i = 1; i < ys.length; i += 1) {
        expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(NODE_HEIGHT + ROW_GAP - 0.001)
      }
    }
  })

  it('orders the columns so the lines do not cross', () => {
    const p = plan()
    // Emitted in an order that would cross badly if nothing reordered it: the
    // keys are listed backwards against the places their material sits in.
    p.keys = [p.keys[2], p.keys[1], p.keys[0]]
    const layout = layoutGraph(buildGraph(p, baseWorld(p)))
    expect(crossings(layout)).toBe(0)
  })

  it('keeps a key beside the material that belongs to it', () => {
    const p = plan()
    const layout = layoutGraph(buildGraph(p, baseWorld(p)))
    const at = (id: string) => layout.nodes.find((node) => node.id === id)!
    // Key A's device and backup should sit either side of Key A's own row
    // rather than at the far end of their column.
    const key = at('key:k1').y
    expect(Math.abs(at('device:d1').y - key)).toBeLessThan(4 * (NODE_HEIGHT + ROW_GAP))
  })

  it('is wide enough for every column and tall enough for every row', () => {
    const p = plan()
    const layout = layoutGraph(buildGraph(p, baseWorld(p)))
    for (const node of layout.nodes) {
      expect(node.x + NODE_WIDTH).toBeLessThanOrEqual(layout.width)
      expect(node.y + NODE_HEIGHT).toBeLessThanOrEqual(layout.height)
    }
  })

  it('draws an edge for every edge the engine gave it', () => {
    const p = plan()
    const graph = buildGraph(p, baseWorld(p))
    expect(layoutGraph(graph).edges).toHaveLength(graph.edges.length)
  })

  it('traces the whole chain a node belongs to, in both directions', () => {
    const p = plan()
    const graph = buildGraph(p, baseWorld(p))
    const lit = connectedTo(graph, 'key:k1')
    // Up to the wallet, and down to the place the device sits in.
    expect(lit.has('wallet:w')).toBe(true)
    expect(lit.has('place:a')).toBe(true)
    // Not sideways into a key it shares nothing with below the path.
    expect(lit.has('device:d2')).toBe(false)
  })

  it('lays out an unreachable world without losing anything', () => {
    const p = plan()
    const graph = buildGraph(p, without(baseWorld(p), { locations: ['a', 'b', 'c'] }))
    const layout = layoutGraph(graph)
    expect(layout.nodes).toHaveLength(graph.nodes.length)
    expect(layout.edges.every((edge) => edge.live)).toBe(false)
  })
})
