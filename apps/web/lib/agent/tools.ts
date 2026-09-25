'use client'

import {
  baseWorld,
  createBackup,
  evaluateWallet,
  without,
  defaultShape,
  createContext,
  enumerateScenarios,
  fixesFor,
  improve,
  inspect,
  planFromShape,
  PRESETS,
  runScenario,
  type Plan,
} from '@outlive/core'
import { useStore } from '@/lib/store.ts'
import { navigateTo, type ViewId } from '@/lib/router.ts'
import { reportFor } from '@/lib/analysis.ts'
import { toShape } from '@/lib/shape-input.ts'
import { netChange } from '@/lib/net.ts'

/**
 * The tools a browser's own AI agent can call on this page, through WebMCP.
 *
 * WebMCP lets a page register tools that an agent built into the reader's
 * browser can call, with the tools running here, in the page, on the plan in
 * this browser. That fits this program unusually well: the page sends
 * nothing anywhere to be driven, and the security policy is untouched. What
 * the agent then does with the answers is the browser's business, and the
 * terms say so.
 *
 * Every tool acts the way a person would, through the same store actions and
 * views: a change is one undo step and says what it did in a toast, so the
 * reader watches an assistant work rather than finding a different plan. A
 * string an agent passes goes through the key-material guard like any typed
 * into a field. Nothing here reaches the Claude key or the Claude request.
 */

export interface AgentTool {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: {
    readOnlyHint?: boolean
    consequentialHint?: boolean
    untrustedContentHint?: boolean
  }
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

/** Thrown for anything an agent asked that cannot be done, with the reason. */
class Refused extends Error {}

const VIEWS: ViewId[] = [
  'overview',
  'build',
  'design',
  'findings',
  'map',
  'runbook',
  'recovery',
  'letter',
  'compare',
  'file',
  'reasoning',
]

function active(): Plan {
  const state = useStore.getState()
  const plan = state.plans.find((entry) => entry.id === state.activeId)
  if (!plan) throw new Refused('No plan is open. Build one first with outlive_build_plan.')
  return plan
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Refused(`${field} is required.`)
  const refusal = inspect(value).hits.find((hit) => hit.strength === 'refuse')
  if (refusal)
    throw new Refused(
      `${field} was refused: it looks like ${refusal.found}. Never pass key material.`
    )
  return value.trim()
}

/** Tell the reader what an assistant just did, in the place they would look. */
function announce(message: string, detail?: string, undoable = true) {
  useStore.getState().notify({ tone: 'ok', message: `Assistant: ${message}`, detail, undoable })
}

/** A change is its own undo step, never folded into whatever came before. */
function edit(recipe: (draft: Plan) => void) {
  useStore.setState({ lastEditAt: 0 })
  useStore.getState().edit(recipe)
}

/** Find a thing in the plan by its label or its id, case-insensitively. */
function find<T extends { id: string; label: string }>(
  items: T[],
  wanted: string,
  noun: string
): T {
  const key = wanted.trim().toLowerCase()
  const found = items.find((item) => item.id === wanted || item.label.toLowerCase() === key)
  if (!found)
    throw new Refused(
      `No ${noun} called "${wanted}". There are: ${items.map((item) => item.label).join(', ') || 'none'}.`
    )
  return found
}

function summary(plan: Plan) {
  const label = (id: string | null, list: { id: string; label: string }[]) =>
    list.find((entry) => entry.id === id)?.label ?? null
  return {
    name: plan.name,
    profile: plan.profile,
    places: plan.locations.map((place) => ({
      label: place.label,
      kind: place.kind,
      travelMinutes: place.travelMinutes,
      disasterGroup: place.disasterGroup,
    })),
    people: plan.people.map((person) => ({ label: person.label, role: person.role })),
    devices: plan.devices.map((device) => ({
      label: device.label,
      maker: device.vendor,
      model: device.model,
      kind: device.kind,
    })),
    keys: plan.keys.map((key) => ({
      label: key.label,
      device: label(key.deviceId, plan.devices),
      deviceKeptAt: label(key.deviceLocationId, plan.locations),
      heldBy: label(key.heldBy, plan.people),
      backups: key.backups.map((backup) => ({
        label: backup.label,
        medium: backup.medium,
        keptAt: label(backup.locationId, plan.locations),
      })),
    })),
    wallets: plan.wallets.map((wallet) => ({
      label: wallet.label,
      tier: wallet.tier,
      paths: wallet.paths.map((path) => ({
        label: path.label,
        threshold: path.threshold,
        keys: path.keyIds.map((id) => label(id, plan.keys)),
        timelockDays: path.timelockDays,
      })),
      descriptorCopiesAt: wallet.configBackups.map((copy) =>
        label(copy.locationId, plan.locations)
      ),
    })),
    // Changes applied to the plan that the world has not caught up with.
    changesToMake: plan.changes.filter((entry) => entry.doneAt === null).map((entry) => entry.text),
  }
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'outlive_get_plan',
    title: 'Read the plan',
    description:
      'Read the open Bitcoin custody plan in outlive.diy: its places, people, signing devices, keys with where each device and backup is kept, and wallets with their spend thresholds. Structure only; the plan never holds seeds, keys or addresses.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async () => summary(active()),
  },
  {
    name: 'outlive_list_findings',
    title: 'List what is wrong',
    description:
      "List the analysis findings for the open plan, worst first: each with its id, rule, severity, title, what is wrong and the recommended change. Use a finding's id with outlive_find_fixes.",
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () =>
      reportFor(active()).findings.map((finding) => ({
        id: finding.id,
        rule: finding.rule,
        severity: finding.severity,
        title: finding.title,
        detail: finding.detail,
        remediation: finding.remediation,
      })),
  },
  {
    name: 'outlive_list_worlds',
    title: 'List every way it fails',
    description:
      'List every failure world the engine builds for the open plan (a place destroyed, a device lost, someone breaking in, the owner dying) with what happens to each wallet in it. Use a world id with outlive_show_world to draw it on the map.',
    inputSchema: {
      type: 'object',
      properties: {
        onlyBreaking: {
          type: 'boolean',
          description: 'Only worlds where a wallet is lost or taken.',
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const plan = active()
      const ctx = createContext(plan)
      return enumerateScenarios(ctx)
        .map((scenario) => runScenario(ctx, scenario))
        .filter((result) => !input.onlyBreaking || result.alarming)
        .map((result) => ({
          id: result.scenario.id,
          event: result.scenario.label,
          wallets: result.wallets.map((outcome) => ({
            wallet: plan.wallets.find((wallet) => wallet.id === outcome.walletId)?.label,
            verdict: outcome.verdict,
          })),
        }))
    },
  },
  {
    name: 'outlive_go_to',
    title: 'Show a view',
    description:
      'Show the reader one view of outlive.diy: overview, build, design (with a step: profile, locations, people, devices, keys, wallets, checks), findings, map, runbook, recovery, letter, compare, file or reasoning.',
    inputSchema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: VIEWS },
        step: {
          type: 'string',
          enum: ['profile', 'locations', 'people', 'devices', 'keys', 'wallets', 'checks'],
        },
      },
      required: ['view'],
    },
    execute: async (input) => {
      const view = input.view as ViewId
      if (!VIEWS.includes(view)) throw new Refused(`Unknown view. One of: ${VIEWS.join(', ')}.`)
      navigateTo(view, view === 'design' && typeof input.step === 'string' ? input.step : undefined)
      return { showing: view }
    },
  },
  {
    name: 'outlive_show_world',
    title: 'Draw a failure world on the map',
    description:
      'Draw one failure world on the map so the reader watches what it does to the plan. Takes a world id from outlive_list_worlds.',
    inputSchema: {
      type: 'object',
      properties: { worldId: { type: 'string' } },
      required: ['worldId'],
    },
    execute: async (input) => {
      const plan = active()
      const id = text(input.worldId, 'worldId')
      if (!enumerateScenarios(createContext(plan)).some((scenario) => scenario.id === id))
        throw new Refused('No such world. List them with outlive_list_worlds.')
      navigateTo('map', id)
      return { drawing: id }
    },
  },
  {
    name: 'outlive_take_away',
    title: 'Take things away on the map',
    description:
      'On the map, take away places, signing devices, keys or people by their labels, as if they were destroyed or lost, and report what happens to each wallet. Several at once is allowed. The reader sees each one struck out and the verdicts change; it changes nothing in the plan.',
    inputSchema: {
      type: 'object',
      properties: { labels: { type: 'array', items: { type: 'string' }, minItems: 1 } },
      required: ['labels'],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const plan = active()
      const labels = Array.isArray(input.labels)
        ? input.labels.map((entry) => text(entry, 'label'))
        : []
      if (labels.length === 0) throw new Refused('labels is required.')
      const items = labels.map((wanted) => {
        const key = wanted.toLowerCase()
        const place = plan.locations.find((entry) => entry.label.toLowerCase() === key)
        if (place) return { kind: 'locations' as const, id: place.id, label: place.label }
        const person = plan.people.find((entry) => entry.label.toLowerCase() === key)
        if (person) return { kind: 'people' as const, id: person.id, label: person.label }
        const thing = [...plan.devices, ...plan.keys].find(
          (entry) => entry.label.toLowerCase() === key
        )
        if (thing) return { kind: 'objects' as const, id: thing.id, label: thing.label }
        throw new Refused(`Nothing called "${wanted}" to take away.`)
      })
      // Left for the map to pick up when it mounts, and announced for a map
      // already on screen. Either way the reader sees each one struck out.
      pending = items
      navigateTo('map')
      window.dispatchEvent(new CustomEvent(AGENT_KNOCKOUT))
      announce(
        `took away ${items.map((item) => item.label).join(', ')} on the map`,
        'Nothing in the plan changed.',
        false
      )
      const world = without(baseWorld(plan), {
        locations: items.filter((item) => item.kind === 'locations').map((item) => item.id),
        objects: items.filter((item) => item.kind === 'objects').map((item) => item.id),
        people: items.filter((item) => item.kind === 'people').map((item) => item.id),
      })
      return plan.wallets.map((wallet) => ({
        wallet: wallet.label,
        spendable: evaluateWallet(plan, wallet, world).spendable,
      }))
    },
  },
  {
    name: 'outlive_find_fixes',
    title: 'Find the changes that fix a finding',
    description:
      'For one finding id, try every small change the engine knows how to make against the whole analysis, and return those that close it without opening anything as bad, best first, with what each closes and opens. Nothing is changed.',
    inputSchema: {
      type: 'object',
      properties: { findingId: { type: 'string' } },
      required: ['findingId'],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) =>
      fixesFor(active(), text(input.findingId, 'findingId')).map((result) => ({
        fixId: result.fix.id,
        change: result.fix.label,
        kind: result.fix.kind,
        closes: result.closes.map((finding) => finding.title),
        opens: result.opens.map((finding) => finding.title),
      })),
  },
  {
    name: 'outlive_apply_fix',
    title: 'Apply a fix',
    description:
      'Apply one fix found by outlive_find_fixes, by finding id and fix id. Structural fixes move, add or copy things in the plan. A fix whose kind is "record" states the reader did something in the world, such as restoring a backup today: apply it only when the reader has told you they did. One undo step.',
    inputSchema: {
      type: 'object',
      properties: { findingId: { type: 'string' }, fixId: { type: 'string' } },
      required: ['findingId', 'fixId'],
    },
    annotations: { consequentialHint: true },
    execute: async (input) => {
      const found = fixesFor(active(), text(input.findingId, 'findingId'), { limit: 20 }).find(
        (result) => result.fix.id === input.fixId
      )
      if (!found)
        throw new Refused(
          'That fix is not on offer for that finding any more. Ask again with outlive_find_fixes.'
        )
      useStore.setState({ lastEditAt: 0 })
      useStore.getState().applyPlan(found.plan)
      announce(found.fix.label, netChange(found.closes.length, found.opens.length))
      return { applied: found.fix.label, closed: found.closes.map((finding) => finding.title) }
    },
  },
  {
    name: 'outlive_next_move',
    title: 'Make the next move',
    description:
      'Find the single structural change that closes the most findings without opening anything critical. With apply true, make it (one undo step); otherwise only describe it.',
    inputSchema: { type: 'object', properties: { apply: { type: 'boolean' } } },
    annotations: { consequentialHint: true },
    execute: async (input) => {
      const move = improve(active(), { maxSteps: 1 })
      if (move.steps.length === 0)
        return {
          move: null,
          applied: false,
          reason: 'No structural change closes more than it opens.',
        }
      const described = move.steps.map((step) => step.fix.label)
      if (input.apply === true) {
        useStore.setState({ lastEditAt: 0 })
        useStore.getState().applyPlan(move.plan)
        announce(described.join(', then '))
      }
      return {
        move: described,
        closes: move.steps.flatMap((step) => step.closes.map((finding) => finding.title)),
        applied: input.apply === true,
      }
    },
  },
  {
    name: 'outlive_apply_template',
    title: 'Apply a starting template',
    description: `Add a template to the plan. Templates only add, never replace. Ids: ${PRESETS.map((preset) => `${preset.id} (${preset.label})`).join('; ')}.`,
    inputSchema: {
      type: 'object',
      properties: { templateId: { type: 'string', enum: PRESETS.map((preset) => preset.id) } },
      required: ['templateId'],
    },
    annotations: { consequentialHint: true },
    execute: async (input) => {
      const preset = PRESETS.find((entry) => entry.id === input.templateId)
      if (!preset) throw new Refused('Unknown template.')
      const blocked = preset.blocked(active())
      if (blocked) throw new Refused(blocked)
      edit((draft) => preset.apply(draft))
      navigateTo('design', preset.step)
      announce(preset.label, preset.detail)
      return { applied: preset.label }
    },
  },
  {
    name: 'outlive_place',
    title: 'Move where something is kept',
    description:
      "Say where a key's signing device or its backup is kept, by the key's label and the place's label. For a backup, moves the key's first backup, or adds one if it has none. One undo step.",
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        what: { type: 'string', enum: ['device', 'backup'] },
        place: { type: 'string' },
      },
      required: ['key', 'what', 'place'],
    },
    annotations: { consequentialHint: true },
    execute: async (input) => {
      const plan = active()
      const key = find(plan.keys, text(input.key, 'key'), 'key')
      const place = find(plan.locations, text(input.place, 'place'), 'place')
      if (input.what !== 'device' && input.what !== 'backup')
        throw new Refused('what is device or backup.')
      if (key.heldBy)
        throw new Refused(`${key.label} is held by somebody else; nothing of it is kept by you.`)
      edit((draft) => {
        const target = draft.keys.find((entry) => entry.id === key.id)!
        if (input.what === 'device') target.deviceLocationId = place.id
        else if (target.backups[0]) target.backups[0].locationId = place.id
        else
          target.backups.push(
            createBackup({ label: 'Steel plate', medium: 'steel', locationId: place.id })
          )
      })
      navigateTo('design', 'keys')
      announce(`${key.label}'s ${input.what} is now kept at ${place.label}`)
      return { key: key.label, what: input.what, place: place.label }
    },
  },
  {
    name: 'outlive_set_threshold',
    title: 'Change how many keys a wallet needs',
    description:
      "Set how many keys a wallet's spend path needs, by wallet label and optionally path label (the first path otherwise). One undo step.",
    inputSchema: {
      type: 'object',
      properties: {
        wallet: { type: 'string' },
        path: { type: 'string' },
        threshold: { type: 'integer', minimum: 1 },
      },
      required: ['wallet', 'threshold'],
    },
    annotations: { consequentialHint: true },
    execute: async (input) => {
      const plan = active()
      const wallet = find(plan.wallets, text(input.wallet, 'wallet'), 'wallet')
      const path =
        typeof input.path === 'string' ? find(wallet.paths, input.path, 'path') : wallet.paths[0]
      if (!path) throw new Refused(`${wallet.label} has no way to spend.`)
      const threshold = Number(input.threshold)
      if (!Number.isInteger(threshold) || threshold < 1 || threshold > path.keyIds.length)
        throw new Refused(`threshold must be between 1 and ${path.keyIds.length}.`)
      edit((draft) => {
        const target = draft.wallets
          .find((entry) => entry.id === wallet.id)
          ?.paths.find((entry) => entry.id === path.id)
        if (target) target.threshold = threshold
      })
      navigateTo('design', 'wallets')
      announce(`${wallet.label} now needs ${threshold} of ${path.keyIds.length}`)
      return { wallet: wallet.label, path: path.label, threshold }
    },
  },
  {
    name: 'outlive_build_plan',
    title: 'Build a new plan from a shape',
    description:
      "Create a whole new plan from its shape: keys and threshold, whether one key is held by a cosigning service, places (kind, travel minutes, whether in another region), where each key's device and backup sit (place indexes, -1 for none), places holding the wallet descriptor, and places a successor can open after death. It is opened as the current plan; nothing existing is changed.",
    inputSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'integer' },
        keys: { type: 'integer' },
        collaborative: { type: 'boolean' },
        hotWallet: { type: 'boolean' },
        places: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string' },
              travelMinutes: { type: 'integer' },
              far: { type: 'boolean' },
            },
          },
        },
        placement: {
          type: 'array',
          items: {
            type: 'object',
            properties: { device: { type: 'integer' }, backup: { type: 'integer' } },
          },
        },
        configPlaces: { type: 'array', items: { type: 'integer' } },
        successorPlaces: { type: 'array', items: { type: 'integer' } },
      },
      required: ['threshold', 'keys'],
    },
    annotations: { consequentialHint: true },
    execute: async (input) => {
      const { shape } = toShape(input, defaultShape())
      const plan = planFromShape(shape)
      useStore.getState().addPlan(plan)
      navigateTo('overview')
      announce(
        `built a ${shape.threshold} of ${shape.keys} plan across ${shape.places.length} places`,
        'It is a new plan; your others are untouched.'
      )
      return { created: plan.name, findings: reportFor(plan).counts }
    },
  },
  {
    name: 'outlive_undo',
    title: 'Undo the last change',
    description: 'Undo the last change to the plan, whoever made it.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { consequentialHint: true },
    execute: async () => {
      useStore.getState().undo()
      announce('undid the last change', undefined, false)
      return { undone: true }
    },
  },
]

/** The event the map listens for when an agent takes things away. */
export const AGENT_KNOCKOUT = 'outlive:agent-knockout'

export interface AgentKnockout {
  kind: 'locations' | 'objects' | 'people'
  id: string
  label: string
}

let pending: AgentKnockout[] | null = null

/** What an agent asked the map to take away, once. */
export function takeAgentKnockouts(): AgentKnockout[] | null {
  const items = pending
  pending = null
  return items
}

/** Run a tool, turning a refusal into an answer an agent can read. */
export async function runTool(tool: AgentTool, input: unknown): Promise<unknown> {
  try {
    return await tool.execute((input ?? {}) as Record<string, unknown>)
  } catch (error) {
    if (error instanceof Refused) return { ok: false, reason: error.message }
    throw error
  }
}
