'use client'

import { ArrowUpRight, CircleAlert, CircleCheck, Eraser, Eye } from 'lucide-react'
import {
  describeDuration,
  evaluateWallet,
  findingsFor,
  recoveryTiming,
  type AnalysisReport,
  type GraphNode,
  type Plan,
  type PlanGraph,
  type Ref,
} from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { QuorumBar } from './QuorumBar.tsx'
import type { Lens } from './Lens.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * What the engine knows about one box, in the world the diagram is drawn in.
 *
 * This is what makes the map an instrument rather than a picture with controls
 * above it. Clicking a node used to leave the page for a form, which threw away
 * the world you were looking at in order to show you a field. Now the answer
 * arrives beside the picture: what this is, whether it can be had here and why
 * not, what leans on it, what it leans on, and what the findings say about it.
 *
 * The two actions close the loop. Take it away, or put somebody else inside it,
 * and the same diagram is redrawn in that world. Both are scenarios the engine
 * already enumerated, looked up rather than constructed, so the map can only
 * ever offer a world the findings have also considered.
 */

const KIND_NOUN: Record<string, string> = {
  wallet: 'Wallet',
  path: 'Way to spend',
  config: 'Wallet configuration',
  key: 'Key',
  device: 'Signing device',
  backup: 'Backup',
  share: 'Backup share',
  passphrase: 'Passphrase',
  pin: 'PIN',
  place: 'Place',
  person: 'Person',
}

/** Where an entity is edited. */
const SECTION: Record<string, string> = {
  location: 'locations',
  person: 'people',
  device: 'devices',
  key: 'keys',
  wallet: 'wallets',
  backup: 'keys',
  path: 'wallets',
}

/**
 * What the two directions of an edge are called, which depends on what the node
 * is. Down from a place is the person who can open the door; up from it is what
 * is kept inside. "What it needs" would be true of both and useful for neither.
 */
const DIRECTION: Record<string, { down: string | null; up: string | null }> = {
  wallet: { down: 'What it needs', up: null },
  path: { down: 'Keys it can use', up: 'The wallet it spends' },
  config: { down: 'Where it is kept', up: 'The wallet it belongs to' },
  key: { down: 'What it exists as', up: 'Ways to spend that use it' },
  device: { down: 'Where it is kept', up: 'The key it holds' },
  backup: { down: 'Where it is kept', up: 'The key it rebuilds' },
  share: { down: 'Where it is kept', up: 'The key it rebuilds' },
  passphrase: { down: 'Where it is kept', up: 'The key it gates' },
  pin: { down: 'Where it is kept', up: 'The key it unlocks' },
  place: { down: 'Who can open it', up: 'What is kept here' },
  person: { down: null, up: 'Doors they can open' },
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow mb-1.5">{title}</p>
      {children}
    </div>
  )
}

function Names({ nodes }: { nodes: GraphNode[] }) {
  return (
    <ul className="grid gap-1">
      {nodes.map((node) => (
        <li key={node.id} className="flex items-baseline gap-1.5 text-[0.8125rem] leading-snug">
          <span className={node.available ? 'text-body' : 'text-muted line-through'}>
            {node.label}
          </span>
          <span className="text-[0.6875rem] text-faint">
            {(KIND_NOUN[node.kind] ?? node.kind).toLowerCase()}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function NodeDetail({
  plan,
  graph,
  report,
  node,
  lens,
  onEdit,
  onClear,
}: {
  plan: Plan
  graph: PlanGraph
  report: AnalysisReport
  node: GraphNode
  lens: Lens
  onEdit: (ref: Ref) => void
  onClear: () => void
}) {
  const adversary = graph.world.actor === 'adversary'
  const byId = new Map(graph.nodes.map((entry) => [entry.id, entry]))
  const needs = graph.edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => byId.get(edge.to))
    .filter((entry): entry is GraphNode => Boolean(entry))
  const neededBy = graph.edges
    .filter((edge) => edge.to === node.id)
    .map((edge) => byId.get(edge.from))
    .filter((entry): entry is GraphNode => Boolean(entry))

  const findings = node.ref ? findingsFor(report, node.ref.type, node.ref.id) : []

  // A wallet is the one node whose state is worth more than a sentence.
  const wallet =
    node.kind === 'wallet' ? plan.wallets.find((w) => `wallet:${w.id}` === node.id) : null
  const availability = wallet ? evaluateWallet(plan, wallet, graph.world) : null
  const timing = wallet ? recoveryTiming(plan, wallet, graph.world) : null
  const best = availability?.paths.find((path) => path.pathId === availability.viaPathId) ?? null
  const bestPath = wallet && best ? wallet.paths.find((path) => path.id === best.pathId) : null

  const remove = node.ref ? lens.find(node.ref, 'availability') : null
  const intrude = node.ref ? lens.find(node.ref, 'adversary') : null

  const { down, up } = DIRECTION[node.kind] ?? { down: 'What it needs', up: 'What leans on it' }
  const good = adversary ? !node.available : node.available
  const state = adversary
    ? node.available
      ? 'They have this in this world.'
      : `Out of their reach here${node.blocker ? `: ${node.blocker}` : ''}.`
    : node.available
      ? 'Within reach in this world.'
      : `Not available here${node.blocker ? `: ${node.blocker}` : ''}.`

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <p className="eyebrow">{KIND_NOUN[node.kind] ?? node.kind}</p>
          <h3 className="text-[0.95rem] font-semibold text-strong">{node.label}</h3>
          <p
            className={cn(
              'mt-1 flex items-center gap-1.5 text-[0.8125rem]',
              good ? 'text-ok' : 'text-critical'
            )}
          >
            {good ? (
              <CircleCheck className="size-3.5 flex-none" aria-hidden />
            ) : (
              <CircleAlert className="size-3.5 flex-none" aria-hidden />
            )}
            {state}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {remove ? (
            <Button size="sm" onClick={() => lens.set(remove.id)} title={remove.label}>
              <Eraser className="size-3.5" aria-hidden />
              Take it away
            </Button>
          ) : null}
          {intrude ? (
            <Button size="sm" onClick={() => lens.set(intrude.id)} title={intrude.label}>
              <Eye className="size-3.5" aria-hidden />
              Somebody opens it
            </Button>
          ) : null}
          {node.ref && SECTION[node.ref.type] ? (
            <Button size="sm" onClick={() => onEdit(node.ref!)}>
              Edit
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClear}>
            Close
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {/* An empty column is left out rather than filled with "Nothing.",
            which is a row of text saying the panel had nothing to say. */}
        {down && needs.length > 0 ? (
          <Column title={down}>
            <Names nodes={needs} />
          </Column>
        ) : null}

        {wallet && best && bestPath ? (
          <Column title="Where it stands">
            <QuorumBar
              path={best}
              keyLabels={bestPath.keyIds.map((id) => ({
                id,
                label: plan.keys.find((key) => key.id === id)?.label ?? id,
              }))}
            />
            {timing?.possible ? (
              <p className="mt-2 text-[0.75rem] text-muted">
                Getting there: {describeDuration(timing.days, timing.travelMinutes)}
                {timing.unknowns.length > 0 ? ', at least' : ''}.
              </p>
            ) : null}
          </Column>
        ) : null}

        {up && neededBy.length > 0 ? (
          <Column title={up}>
            <Names nodes={neededBy} />
          </Column>
        ) : null}

        <Column title={`What the findings say (${findings.length})`}>
          {findings.length === 0 ? (
            <p className="text-[0.8125rem] text-faint">
              No rule named this. That means only that this program has no rule for whatever is
              wrong with it.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {findings.slice(0, 5).map((finding) => (
                <li key={finding.id} className="flex items-start gap-2">
                  <SeverityDot severity={finding.severity} className="mt-[0.4rem]" />
                  <span className="min-w-0 text-[0.8125rem] leading-snug text-body">
                    {finding.title}
                  </span>
                </li>
              ))}
              {findings.length > 5 ? (
                <li className="text-[0.75rem] text-faint">and {findings.length - 5} more.</li>
              ) : null}
            </ul>
          )}
        </Column>
      </div>
    </div>
  )
}
