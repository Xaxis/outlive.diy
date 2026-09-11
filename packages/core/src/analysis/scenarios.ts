/**
 * Scenarios: the worlds the engine actually asks its question in.
 *
 * This module is shared by the findings, the interactive stress test and the
 * recovery documents, on purpose. If the recovery route for "Site B burns down"
 * were computed by different code from the finding that says Site B burning
 * down is survivable, the two would eventually disagree, and the user would
 * have no way to tell which one was lying.
 *
 * Where a fact is unknown, the direction of the guess follows the perspective.
 * Asking whether *you* can still recover, an unrecorded location is assumed
 * findable, because you know where your own things are. Asking whether an
 * attacker standing in one specific room can spend, it is not, because they are
 * in that room and nowhere else.
 */

import type { Id, Plan, Ref } from '../model/types.ts'
import { disasterGroups, locationsReachableBy } from '../model/selectors.ts'
import type { AnalysisContext } from './context.ts'
import {
  baseWorld,
  evaluateWallet,
  without,
  type WalletAvailability,
  type World,
} from './availability.ts'

export type ScenarioKind =
  | 'location-lost'
  | 'disaster-group-lost'
  | 'key-lost'
  | 'device-lost'
  | 'backup-lost'
  | 'config-lost'
  | 'person-lost'
  | 'user-death'
  | 'location-compromised'
  | 'person-compromised'
  | 'coercion'

/** What a bad answer looks like. */
export type Perspective = 'availability' | 'adversary'

export interface Scenario {
  id: string
  kind: ScenarioKind
  /** Names the event. "Site B is destroyed". */
  label: string
  /** Names the question. "Can you still spend?" */
  question: string
  perspective: Perspective
  world: World
  /**
   * The reader's world once this has happened, when that is not the world the
   * scenario asks its question in.
   *
   * An adversary scenario asks "can they spend", and every answer it gives is
   * about them. A recovery route asks "what can you still do", which is a
   * different actor inside the same event, and reading one off the other
   * inverts every word: the wallets the attacker cannot touch come out
   * labelled lost, and the reasons the reader is safe come out as the reasons
   * there is no route. Same rule as the diagram's colours, and the same one as
   * World.unknownPlacementReachable.
   */
  aftermath?: World
  subjects: Ref[]
}

export type Verdict = 'safe' | 'degraded' | 'lost' | 'exposed'

export interface WalletOutcome {
  walletId: Id
  verdict: Verdict
  availability: WalletAvailability
}

export interface ScenarioResult {
  scenario: Scenario
  wallets: WalletOutcome[]
  /** True when this scenario produces the outcome worth acting on. */
  alarming: boolean
}

/**
 * Locations the user can no longer reach because the person who controls the
 * door is gone. Being entitled to what is inside is not the same as being able
 * to open it.
 */
function locationsHeldBy(plan: Plan, personId: Id): Id[] {
  return plan.locations
    .filter((location) => location.custodianId === personId)
    .map((location) => location.id)
}

export function locationLostScenario(ctx: AnalysisContext, locationId: Id): Scenario {
  const location = ctx.index.locations.get(locationId)
  return {
    id: `location-lost:${locationId}`,
    kind: 'location-lost',
    label: `${location?.label ?? 'A location'} is destroyed or emptied`,
    question: 'Can you still spend?',
    perspective: 'availability',
    world: {
      ...without(ctx.base, { locations: [locationId] }),
      label: `${location?.label ?? 'A location'} gone`,
    },
    subjects: [{ type: 'location', id: locationId }],
  }
}

export function disasterGroupLostScenario(ctx: AnalysisContext, group: string): Scenario {
  const members = ctx.plan.locations.filter((location) => location.disasterGroup === group)
  return {
    id: `disaster-group-lost:${group}`,
    kind: 'disaster-group-lost',
    label: `Everything in "${group}" is lost at once`,
    question: 'Can you still spend?',
    perspective: 'availability',
    world: {
      ...without(ctx.base, { locations: members.map((m) => m.id) }),
      label: `"${group}" gone`,
    },
    subjects: members.map((member) => ({ type: 'location' as const, id: member.id })),
  }
}

export function objectLostScenario(
  ctx: AnalysisContext,
  kind: 'key-lost' | 'device-lost' | 'backup-lost' | 'config-lost',
  objectId: Id,
  objectLabel: string
): Scenario {
  return {
    id: `${kind}:${objectId}`,
    kind,
    label: `${objectLabel} is lost or destroyed`,
    question: 'Can you still spend?',
    perspective: 'availability',
    world: { ...without(ctx.base, { objects: [objectId] }), label: `${objectLabel} gone` },
    subjects: [
      {
        type:
          kind === 'key-lost'
            ? 'key'
            : kind === 'device-lost'
              ? 'device'
              : kind === 'config-lost'
                ? 'wallet'
                : 'backup',
        id: objectId,
      },
    ],
  }
}

export function personLostScenario(ctx: AnalysisContext, personId: Id): Scenario {
  const person = ctx.index.people.get(personId)
  return {
    id: `person-lost:${personId}`,
    kind: 'person-lost',
    label: `${person?.label ?? 'A person'} is unavailable`,
    question: 'Can you still spend?',
    perspective: 'availability',
    world: {
      ...without(ctx.base, {
        people: [personId],
        locations: locationsHeldBy(ctx.plan, personId),
      }),
      label: `${person?.label ?? 'A person'} unavailable`,
    },
    subjects: [{ type: 'person', id: personId }],
  }
}

/**
 * The user dies. Memory goes with them, which takes every memorised passphrase,
 * every PIN nobody else knows and every password on an encrypted archive. What
 * remains is what other people can physically reach, after whatever delay the
 * plan recorded against that access.
 */
export function userDeathScenario(ctx: AnalysisContext, personId: Id | null): Scenario {
  const person = personId ? ctx.index.people.get(personId) : null
  const heirs = personId
    ? [personId]
    : ctx.plan.people
        .filter((p) => p.role === 'successor' || p.role === 'executor')
        .map((p) => p.id)

  const reachable = new Set<Id>()
  let delay = 0
  for (const heir of heirs) {
    for (const entry of locationsReachableBy(ctx.plan, heir, 'after-death')) {
      reachable.add(entry.location.id)
      delay = Math.max(delay, entry.delayDays)
    }
  }

  return {
    id: personId ? `user-death:${personId}` : 'user-death:all',
    kind: 'user-death',
    label: person ? `You die and ${person.label} acts alone` : 'You die',
    question: person ? `Can ${person.label} reach the coins?` : 'Can anyone reach the coins?',
    perspective: 'availability',
    world: baseWorld(ctx.plan, {
      label: person ? `After your death, ${person.label} acting` : 'After your death',
      actor: 'successor',
      reachable,
      unknownPlacementReachable: false,
      memory: false,
      cooperating: heirs,
      elapsedDays: Math.max(delay, ctx.options.inheritanceElapsedDays),
    }),
    subjects: personId ? [{ type: 'person', id: personId }] : [{ type: 'plan', id: ctx.plan.id }],
  }
}

/**
 * One place is opened by somebody who should not have opened it. They get what
 * is in it and nothing else: no memorised secrets, no cooperation, and no
 * knowledge of anything the plan did not place there.
 */
export function locationCompromisedScenario(ctx: AnalysisContext, locationId: Id): Scenario {
  const location = ctx.index.locations.get(locationId)
  return {
    id: `location-compromised:${locationId}`,
    kind: 'location-compromised',
    label: `${location?.label ?? 'A location'} is opened by someone else`,
    question: 'Can they spend?',
    perspective: 'adversary',
    world: baseWorld(ctx.plan, {
      label: `Inside ${location?.label ?? 'a location'}`,
      actor: 'adversary',
      reachable: [locationId],
      unknownPlacementReachable: false,
      memory: false,
      cooperating: [],
      elapsedDays: 0,
    }),
    // Whatever was in there is in somebody else's hands, so you plan without
    // it. That is the same world as losing the place, which is the
    // conservative reading and the only safe one: a container you can still
    // open is a container they can open again.
    aftermath: {
      ...without(ctx.base, { locations: [locationId] }),
      label: `Without ${location?.label ?? 'that place'}`,
    },
    subjects: [{ type: 'location', id: locationId }],
  }
}

export function personCompromisedScenario(ctx: AnalysisContext, personId: Id): Scenario {
  const person = ctx.index.people.get(personId)
  const reachable = [
    ...locationsReachableBy(ctx.plan, personId, 'always').map((entry) => entry.location.id),
    ...locationsHeldBy(ctx.plan, personId),
  ]
  return {
    id: `person-compromised:${personId}`,
    kind: 'person-compromised',
    label: `${person?.label ?? 'A person'} acts against you`,
    question: 'Can they spend?',
    perspective: 'adversary',
    world: baseWorld(ctx.plan, {
      label: `${person?.label ?? 'A person'} acting alone`,
      actor: 'adversary',
      reachable,
      unknownPlacementReachable: false,
      memory: false,
      cooperating: [personId],
      elapsedDays: 0,
    }),
    // Your own reach does not shrink because somebody turned. What you lose is
    // them, and anything only they could open.
    aftermath: {
      ...without(ctx.base, { people: [personId], locations: locationsHeldBy(ctx.plan, personId) }),
      label: `Without ${person?.label ?? 'that person'}`,
    },
    subjects: [{ type: 'person', id: personId }],
  }
}

/**
 * You are present and cooperating, because that is what compulsion means. The
 * question is not whether you would resist; it is how much exists within reach
 * of a single afternoon.
 *
 * Distance is the only defence this scenario respects, so an unrecorded travel
 * time counts as near. Guessing the other way would let an unfinished plan look
 * coercion-resistant.
 */
export function coercionScenario(ctx: AnalysisContext, budgetMinutes?: number): Scenario {
  const budget = budgetMinutes ?? ctx.options.coercionTravelMinutes
  const reachable = ctx.plan.locations
    .filter((location) => location.travelMinutes === null || location.travelMinutes <= budget)
    .map((location) => location.id)
  const hours = Math.round(budget / 60)
  return {
    id: `coercion:${budget}`,
    kind: 'coercion',
    label: `You are compelled, for ${hours} ${hours === 1 ? 'hour' : 'hours'} of travel`,
    question: 'Can they spend?',
    perspective: 'adversary',
    world: baseWorld(ctx.plan, {
      label: `Under compulsion, within ${hours}h`,
      actor: 'adversary',
      reachable,
      unknownPlacementReachable: true,
      memory: true,
      cooperating: [],
      elapsedDays: 0,
    }),
    // Everything inside the session was handed over, so afterwards you are
    // working from what was not.
    aftermath: { ...without(ctx.base, { locations: reachable }), label: `Beyond ${hours}h` },
    subjects: [{ type: 'plan', id: ctx.plan.id }],
  }
}

// --- running them -----------------------------------------------------------

export function verdictFor(perspective: Perspective, availability: WalletAvailability): Verdict {
  if (perspective === 'adversary') return availability.spendable ? 'exposed' : 'safe'
  if (!availability.spendable) return 'lost'
  return availability.margin > 0 ? 'safe' : 'degraded'
}

export function runScenario(ctx: AnalysisContext, scenario: Scenario): ScenarioResult {
  const wallets: WalletOutcome[] = ctx.plan.wallets.map((wallet) => {
    const availability = evaluateWallet(ctx.plan, wallet, scenario.world)
    return {
      walletId: wallet.id,
      availability,
      verdict: verdictFor(scenario.perspective, availability),
    }
  })
  const alarming = wallets.some((outcome) =>
    scenario.perspective === 'adversary'
      ? outcome.verdict === 'exposed'
      : outcome.verdict === 'lost'
  )
  return { scenario, wallets, alarming }
}

/** Every scenario the engine knows how to build for this plan. */
export function enumerateScenarios(ctx: AnalysisContext): Scenario[] {
  const scenarios: Scenario[] = []
  for (const location of ctx.plan.locations) {
    scenarios.push(locationLostScenario(ctx, location.id))
    scenarios.push(locationCompromisedScenario(ctx, location.id))
  }
  for (const [group, members] of disasterGroups(ctx.plan)) {
    if (members.length < 2) continue
    scenarios.push(disasterGroupLostScenario(ctx, group))
  }
  for (const key of ctx.plan.keys) {
    scenarios.push(objectLostScenario(ctx, 'key-lost', key.id, key.label))
    for (const backup of key.backups) {
      scenarios.push(
        objectLostScenario(ctx, 'backup-lost', backup.id, `${key.label} / ${backup.label}`)
      )
    }
  }
  for (const device of ctx.plan.devices) {
    scenarios.push(objectLostScenario(ctx, 'device-lost', device.id, device.label))
  }
  for (const wallet of ctx.plan.wallets) {
    for (const backup of wallet.configBackups) {
      scenarios.push(
        objectLostScenario(ctx, 'config-lost', backup.id, `${wallet.label} / ${backup.label}`)
      )
    }
  }
  for (const person of ctx.plan.people) {
    scenarios.push(personLostScenario(ctx, person.id))
    scenarios.push(personCompromisedScenario(ctx, person.id))
  }
  scenarios.push(userDeathScenario(ctx, null))
  for (const person of ctx.plan.people) {
    if (person.role !== 'successor' && person.role !== 'executor') continue
    scenarios.push(userDeathScenario(ctx, person.id))
  }
  scenarios.push(coercionScenario(ctx))
  return scenarios
}
