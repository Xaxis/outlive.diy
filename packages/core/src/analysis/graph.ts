/**
 * The plan as a graph.
 *
 * A custody setup is a chain of dependencies, and a table shows one link of it
 * at a time. This turns the whole chain into nodes and edges so it can be
 * drawn: a wallet needs a spend path, a path needs keys, a key is embodied by a
 * device and by whatever is written down, and every one of those objects sits
 * in a place somebody can or cannot open.
 *
 * Every node is evaluated in a `World`, using the same predicates the findings
 * use. That is the whole point of building it here rather than in the browser:
 * the picture and the list are the same answer, and drawing a second evaluator
 * beside the first is how a planner starts contradicting itself.
 */

import type { Id, Plan, Ref, Wallet } from '../model/types.ts'
import { isMultisig, splitGroups } from '../model/selectors.ts'
import {
  backupAvailable,
  deviceRoute,
  evaluateKey,
  evaluateWallet,
  passphraseAvailable,
  placeReachable,
  type World,
} from './availability.ts'

export type GraphNodeKind =
  | 'wallet'
  | 'path'
  | 'config'
  | 'key'
  | 'device'
  | 'backup'
  | 'share'
  | 'passphrase'
  | 'pin'
  | 'place'
  | 'person'

/**
 * Which column a node sits in. Dependency flows left to right: the wallet at
 * the left needs what is to its right, and the rightmost column is the physical
 * world the whole thing rests on.
 */
export const LAYER: Record<GraphNodeKind, number> = {
  wallet: 0,
  path: 1,
  config: 1,
  key: 2,
  device: 3,
  backup: 3,
  share: 3,
  passphrase: 3,
  pin: 3,
  place: 4,
  person: 5,
}

/**
 * Short on purpose. These sit above columns 140px wide, and a heading that
 * truncates is worse than a heading that is terse.
 */
export const LAYER_LABELS = [
  'Wallets',
  'What it needs',
  'Keys',
  'Key material',
  'Places',
  'People',
] as const

export interface GraphNode {
  /** Stable, prefixed by kind so ids from different collections cannot collide. */
  id: string
  kind: GraphNodeKind
  label: string
  /** A second line: the threshold, the medium, how far away the place is. */
  detail: string | null
  /** What this stands for in the plan, for selection and for findings. */
  ref: Ref | null
  layer: number
  /** Whether this can be obtained, or used, in the world the graph was built in. */
  available: boolean
  /** Why not. Null when it is available, or when there is nothing useful to say. */
  blocker: string | null
}

export type GraphEdgeKind = 'needs' | 'holds' | 'kept-at' | 'opens'

export interface GraphEdge {
  id: string
  from: string
  to: string
  kind: GraphEdgeKind
  /** Both ends available: the dependency is satisfied in this world. */
  live: boolean
  label: string | null
}

export interface PlanGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Present layers, ascending. A plan with no people has no people column. */
  layers: number[]
  /** The world it was evaluated in, so a caption can say what is being shown. */
  world: World
}

export interface GraphOptions {
  /** Draw one wallet and only what it depends on. */
  walletId?: Id | null
  /** People are worth a column only when the question involves them. */
  includePeople?: boolean
}

const nodeId = (kind: GraphNodeKind, id: string) => `${kind}:${id}`

function travel(minutes: number | null): string | null {
  if (minutes === null) return null
  if (minutes === 0) return 'here'
  if (minutes < 60) return `${minutes} min away`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h away` : `${hours}h ${rest}m away`
}

const MEDIUM: Record<string, string> = {
  steel: 'steel',
  paper: 'paper',
  'encrypted-digital': 'encrypted file',
  'plain-digital': 'plain file',
  memorized: 'memorised',
}

/**
 * Build the graph.
 *
 * Nodes are emitted grouped by the thing they hang off, so that a layout which
 * keeps source order produces something readable before it does any crossing
 * reduction at all.
 */
export function buildGraph(plan: Plan, world: World, options: GraphOptions = {}): PlanGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const byId = new Map<string, GraphNode>()
  const edgeIds = new Set<string>()

  const add = (entry: GraphNode) => {
    if (byId.has(entry.id)) return
    byId.set(entry.id, entry)
    nodes.push(entry)
  }
  const node = (id: string) => byId.get(id)
  const link = (from: string, to: string, kind: GraphEdgeKind, label: string | null = null) => {
    const id = `${from}->${to}`
    if (edgeIds.has(id)) return
    edgeIds.add(id)
    // An edge is live when the dependency it draws actually holds, which means
    // both ends of it are available. A live edge into a dead node would be a
    // line the eye follows to a conclusion the engine did not reach.
    const live = Boolean(node(from)?.available && node(to)?.available)
    edges.push({ id, from, to, kind, live, label })
  }

  const wallets = options.walletId
    ? plan.wallets.filter((wallet) => wallet.id === options.walletId)
    : plan.wallets

  // Which keys are in scope. Filtering to one wallet has to filter the whole
  // chain, or the places column fills up with sites the wallet never touches.
  const keyIds = new Set<Id>()
  for (const wallet of wallets) {
    for (const path of wallet.paths) for (const id of path.keyIds) keyIds.add(id)
  }
  const keys = plan.keys.filter((key) => keyIds.has(key.id))

  const placesUsed = new Set<Id>()
  const usePlace = (locationId: Id | null, from: string) => {
    if (locationId === null) return
    const location = plan.locations.find((entry) => entry.id === locationId)
    if (!location) return
    const id = nodeId('place', location.id)
    const reachable = placeReachable(world, location.id)
    add({
      id,
      kind: 'place',
      label: location.label,
      detail:
        [travel(location.travelMinutes), location.disasterGroup].filter(Boolean).join(' · ') ||
        null,
      ref: { type: 'location', id: location.id },
      layer: LAYER.place,
      available: reachable,
      blocker: reachable ? null : 'out of reach',
    })
    placesUsed.add(location.id)
    link(from, id, 'kept-at')
  }

  for (const wallet of wallets) {
    const availability = evaluateWallet(plan, wallet, world)
    const walletNode = nodeId('wallet', wallet.id)
    add({
      id: walletNode,
      kind: 'wallet',
      label: wallet.label,
      detail: [wallet.tier, wallet.decoy ? 'decoy' : null].filter(Boolean).join(' · '),
      ref: { type: 'wallet', id: wallet.id },
      layer: LAYER.wallet,
      available: availability.spendable,
      blocker: availability.blockers[0] ?? null,
    })

    for (const path of wallet.paths) {
      const state = availability.paths.find((entry) => entry.pathId === path.id)
      const id = nodeId('path', path.id)
      const short = path.threshold - (state?.availableKeyIds.length ?? 0)
      add({
        id,
        kind: 'path',
        label: `${path.threshold} of ${path.keyIds.length}`,
        detail:
          path.timelockDays > 0
            ? `${path.label} · opens after ${path.timelockDays} days`
            : path.label,
        ref: { type: 'path', id: path.id },
        layer: LAYER.path,
        available: Boolean(state?.satisfied),
        blocker: state?.satisfied
          ? null
          : state && !state.open
            ? 'not unlocked yet'
            : short > 0
              ? `${short} ${short === 1 ? 'key' : 'keys'} short`
              : null,
      })
      link(walletNode, id, 'needs')

      for (const keyId of path.keyIds) {
        const key = plan.keys.find((entry) => entry.id === keyId)
        if (!key) continue
        const keyState = evaluateKey(plan, key, world)
        const keyNode = nodeId('key', key.id)
        add({
          id: keyNode,
          kind: 'key',
          label: key.label,
          detail: keyState.routes.length
            ? keyState.routes
                .map((route) => (route === 'device' ? 'device' : 'backup'))
                .join(' or ')
            : null,
          ref: { type: 'key', id: key.id },
          layer: LAYER.key,
          available: keyState.usable,
          blocker: keyState.blockers[0] ?? null,
        })
        link(id, keyNode, 'needs')
      }
    }

    // The configuration. For a multisig this is the object whose absence is
    // unrecoverable, so it gets drawn rather than being a line of prose.
    if (isMultisig(wallet)) {
      if (wallet.configBackups.length === 0) {
        const id = nodeId('config', `${wallet.id}-none`)
        add({
          id,
          kind: 'config',
          label: 'No configuration copy',
          detail: 'nothing to restore from',
          ref: null,
          layer: LAYER.config,
          available: false,
          blocker: 'the wallet configuration is not written down anywhere',
        })
        link(walletNode, id, 'needs')
      }
      for (const backup of wallet.configBackups) {
        const id = nodeId('config', backup.id)
        const gone = world.missing.has(backup.id)
        const reachable = !gone && placeReachable(world, backup.locationId)
        const needsMemory = backup.medium === 'encrypted-digital' || backup.medium === 'memorized'
        const available = reachable && (!needsMemory || world.memory)
        add({
          id,
          kind: 'config',
          label: backup.label,
          detail: `${MEDIUM[backup.medium] ?? backup.medium} · configuration`,
          ref: null,
          layer: LAYER.config,
          available,
          blocker: available ? null : gone ? 'gone' : 'out of reach',
        })
        link(walletNode, id, 'needs')
        usePlace(backup.locationId, id)
      }
    }
  }

  // Everything that embodies a key, and where it sits.
  for (const key of keys) {
    const keyNode = nodeId('key', key.id)
    if (!node(keyNode)) continue

    if (key.deviceId) {
      const device = plan.devices.find((entry) => entry.id === key.deviceId)
      if (device) {
        const route = deviceRoute(plan, key, world)
        const id = nodeId('device', device.id)
        add({
          id,
          kind: 'device',
          label: device.label,
          detail: [device.vendor, device.airGapped ? 'air-gapped' : null]
            .filter(Boolean)
            .join(' · '),
          ref: { type: 'device', id: device.id },
          layer: LAYER.device,
          available: route.ok,
          blocker: route.blocker,
        })
        link(keyNode, id, 'holds')
        usePlace(key.deviceLocationId, id)

        if (device.pin.storage === 'written') {
          const pinId = nodeId('pin', device.id)
          const reachable = placeReachable(world, device.pin.locationId)
          add({
            id: pinId,
            kind: 'pin',
            label: `${device.label} PIN`,
            detail: 'written down',
            ref: { type: 'device', id: device.id },
            layer: LAYER.pin,
            available: reachable,
            blocker: reachable ? null : 'out of reach',
          })
          link(keyNode, pinId, 'holds')
          usePlace(device.pin.locationId, pinId)
        }
      }
    }

    const groups = splitGroups(key)
    for (const backup of key.backups) {
      const available = backupAvailable(world, backup)
      const share = backup.split
      const id = nodeId(share ? 'share' : 'backup', backup.id)
      const groupSize = share ? (groups.get(share.groupId)?.shares.length ?? 0) : 0
      add({
        id,
        kind: share ? 'share' : 'backup',
        label: backup.label,
        detail: share
          ? `${MEDIUM[backup.medium] ?? backup.medium} · ${share.threshold} of ${groupSize} · ${key.label}`
          : `${MEDIUM[backup.medium] ?? backup.medium} · ${key.label}`,
        ref: { type: 'backup', id: backup.id },
        layer: LAYER.backup,
        available,
        blocker: available
          ? null
          : world.missing.has(backup.id)
            ? 'gone'
            : backup.medium === 'memorized'
              ? 'nobody remembers it'
              : backup.medium === 'encrypted-digital' && placeReachable(world, backup.locationId)
                ? 'the password is not available'
                : 'out of reach',
      })
      link(keyNode, id, 'holds')
      usePlace(backup.locationId, id)
    }

    if (key.passphrase.enabled) {
      const id = nodeId('passphrase', key.id)
      const available = passphraseAvailable(key, world)
      add({
        id,
        kind: 'passphrase',
        label: `${key.label} passphrase`,
        detail:
          key.passphrase.storage === 'memorized'
            ? 'memorised'
            : key.passphrase.storage === 'split'
              ? `split, ${key.passphrase.splitThreshold ?? 1} shares needed`
              : 'written down',
        ref: { type: 'key', id: key.id },
        layer: LAYER.passphrase,
        available,
        blocker: available ? null : 'out of reach',
      })
      link(keyNode, id, 'holds')
      for (const locationId of key.passphrase.locationIds) usePlace(locationId, id)
    }
  }

  // People, and the doors they can open. Drawn only where they touch a place
  // this graph is already showing, so the column stays about this wallet.
  if (options.includePeople !== false) {
    for (const location of plan.locations) {
      if (!placesUsed.has(location.id)) continue
      for (const access of location.access) {
        const person = plan.people.find((entry) => entry.id === access.personId)
        if (!person) continue
        const id = nodeId('person', person.id)
        const wait = Math.max(
          0,
          ...plan.locations.flatMap((entry) =>
            entry.access
              .filter((other) => other.personId === person.id)
              .map((other) => other.delayDays)
          )
        )
        add({
          id,
          kind: 'person',
          label: person.label,
          detail: wait > 0 ? `${person.role} · waits ${wait}d` : person.role,
          ref: { type: 'person', id: person.id },
          layer: LAYER.person,
          available: world.cooperating.has(person.id),
          blocker: world.cooperating.has(person.id) ? null : 'not available',
        })
        const when =
          access.condition === 'always'
            ? 'now'
            : access.condition === 'with-user'
              ? 'with you'
              : 'after you'
        link(nodeId('place', location.id), id, 'opens', when)
      }
      const custodian = location.custodianId
        ? plan.people.find((entry) => entry.id === location.custodianId)
        : undefined
      if (custodian) {
        const id = nodeId('person', custodian.id)
        add({
          id,
          kind: 'person',
          label: custodian.label,
          detail: custodian.role,
          ref: { type: 'person', id: custodian.id },
          layer: LAYER.person,
          available: world.cooperating.has(custodian.id),
          blocker: world.cooperating.has(custodian.id) ? null : 'not available',
        })
        link(nodeId('place', location.id), id, 'opens', 'the door')
      }
    }
  }

  const layers = [...new Set(nodes.map((entry) => entry.layer))].sort((a, b) => a - b)
  return { nodes, edges, layers, world }
}

/** Wallets whose spending this graph would show, in the order they are drawn. */
export function graphWallets(plan: Plan, walletId?: Id | null): Wallet[] {
  return walletId ? plan.wallets.filter((wallet) => wallet.id === walletId) : plan.wallets
}
