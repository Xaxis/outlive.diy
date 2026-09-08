/**
 * How long a recovery actually takes.
 *
 * The profile asks how long the user could go without being able to move coins.
 * That number was worth nothing while nothing measured against it, so this
 * measures: given a world, the cheapest route to spending a wallet, and the
 * elapsed time that route costs.
 *
 * Every quantity here is one the user already recorded. Travel comes from
 * `travelMinutes`, waiting comes from `timelockDays` and from the `delayDays`
 * on an access, and a person who is reachable in weeks rather than hours comes
 * from `Person.availability`. Nothing is invented, and anything the plan does
 * not say is reported as an unknown rather than guessed at, because a recovery
 * estimate that quietly fills in its own blanks is worse than no estimate.
 *
 * Two arithmetic decisions, both stated rather than buried:
 *
 * A trip to a place costs twice its one-way time, because you have to come back
 * with what you went for. Distinct places are counted once however many objects
 * are collected there.
 *
 * Waiting and travelling do not add up. Probate, a timelock and a person's own
 * availability all run at the same time as each other, so the wait is the
 * longest of them; the travelling starts once the waiting is over.
 */

import type { Id, Plan, Wallet } from '../model/types.ts'
import { isMultisig, splitGroups, wholeBackups } from '../model/selectors.ts'
import {
  backupAvailable,
  deviceRoute,
  evaluateKey,
  evaluateWallet,
  placeReachable,
  type World,
} from './availability.ts'

/** Travel a person is assumed to manage in one day, door to door. */
export const TRAVEL_MINUTES_PER_DAY = 480

/** What `Person.availability` costs in days before they can act at all. */
const AVAILABILITY_DAYS: Record<string, number> = {
  immediate: 0,
  days: 3,
  weeks: 14,
  unknown: 0,
}

export type TimingPart = 'wait' | 'travel'

export interface TimingStep {
  part: TimingPart
  /** What this time is spent on. */
  what: string
  /** Why it costs what it costs, in the plan's own terms. */
  why: string
  days: number
  minutes: number
}

export interface RecoveryTiming {
  walletId: Id
  /** False when the wallet cannot be recovered in this world at all. */
  possible: boolean
  /** Whole days, from the longest wait plus the travelling. */
  days: number
  /** Door-to-door minutes, both ways, over every place that must be visited. */
  travelMinutes: number
  /** Places that must be opened, in the order the greedy route picks them. */
  placeIds: Id[]
  steps: TimingStep[]
  /**
   * What the plan does not record, which is why this figure is a floor. Listed
   * so the interface can say so instead of presenting a guess as a measurement.
   */
  unknowns: string[]
}

interface Route {
  /** Places that have to be opened for this route. */
  placeIds: Id[]
  /** Places whose travel time is not recorded. */
  unknownPlaceIds: Id[]
}

const EMPTY: Route = { placeIds: [], unknownPlaceIds: [] }

function merge(...routes: (Route | null)[]): Route | null {
  const placeIds: Id[] = []
  const unknownPlaceIds: Id[] = []
  for (const route of routes) {
    if (route === null) return null
    for (const id of route.placeIds) if (!placeIds.includes(id)) placeIds.push(id)
    for (const id of route.unknownPlaceIds) {
      if (!unknownPlaceIds.includes(id)) unknownPlaceIds.push(id)
    }
  }
  return { placeIds, unknownPlaceIds }
}

/**
 * Cheapest set of places for one key, or null when the key cannot be obtained.
 *
 * Both routes are costed and the shorter wins, which is the choice a person
 * actually makes: if the device is here and the backup is five hours away, the
 * recovery uses the device.
 */
function keyRoutes(plan: Plan, keyId: Id, world: World, travel: (id: Id) => number): Route | null {
  const key = plan.keys.find((entry) => entry.id === keyId)
  if (!key) return null
  const state = evaluateKey(plan, key, world)
  if (!state.usable) return null

  const place = (locationId: Id | null): Route =>
    locationId === null
      ? EMPTY
      : {
          placeIds: [locationId],
          unknownPlaceIds:
            plan.locations.find((entry) => entry.id === locationId)?.travelMinutes === null
              ? [locationId]
              : [],
        }

  const options: Route[] = []

  if (state.routes.includes('device') && deviceRoute(plan, key, world).ok) {
    const device = plan.devices.find((entry) => entry.id === key.deviceId)
    const parts: Route[] = [place(key.deviceLocationId)]
    // The PIN is only a second stop when it is written down and there is no
    // memory in this world to supply it.
    if (device && device.pin.storage === 'written' && !world.memory) {
      const known = device.pin.knownBy.some((personId) => world.cooperating.has(personId))
      if (!known) parts.push(place(device.pin.locationId))
    }
    const merged = merge(...parts)
    if (merged) options.push(merged)
  }

  if (state.routes.includes('backup')) {
    const whole = wholeBackups(key).filter((backup) => backupAvailable(world, backup))
    for (const backup of whole) options.push(place(backup.locationId))
    for (const [, group] of splitGroups(key)) {
      const have = group.shares.filter((share) => backupAvailable(world, share))
      if (have.length < group.threshold) continue
      const cheapest = [...have]
        .sort((a, b) => travel(a.locationId ?? '') - travel(b.locationId ?? ''))
        .slice(0, group.threshold)
      const merged = merge(...cheapest.map((share) => place(share.locationId)))
      if (merged) options.push(merged)
    }
  }

  if (options.length === 0) return null

  // A written passphrase is a stop on every route, not an alternative to one.
  const passphrase = key.passphrase
  let gate: Route = EMPTY
  if (passphrase.enabled && !world.memory) {
    const known = passphrase.knownBy.some((personId) => world.cooperating.has(personId))
    if (!known && passphrase.storage !== 'memorized') {
      const reachable = passphrase.locationIds.filter((id) => placeReachable(world, id))
      const needed = passphrase.storage === 'split' ? (passphrase.splitThreshold ?? 1) : 1
      const chosen = [...reachable].sort((a, b) => travel(a) - travel(b)).slice(0, needed)
      const merged = merge(...chosen.map((id) => place(id)))
      if (merged) gate = merged
    }
  }

  const costed = options
    .map((option) => merge(option, gate))
    .filter((option): option is Route => option !== null)
  return costed.reduce((best, option) =>
    cost(option, travel) < cost(best, travel) ? option : best
  )
}

function cost(route: Route, travel: (id: Id) => number): number {
  return route.placeIds.reduce((total, id) => total + travel(id) * 2, 0)
}

/** Marginal cost of adding a route to a set of places already being visited. */
function marginal(route: Route, chosen: Set<Id>, travel: (id: Id) => number): number {
  return route.placeIds.reduce((total, id) => (chosen.has(id) ? total : total + travel(id) * 2), 0)
}

export function recoveryTiming(plan: Plan, wallet: Wallet, world: World): RecoveryTiming {
  const availability = evaluateWallet(plan, wallet, world)
  const unknowns: string[] = []

  if (!availability.spendable || availability.viaPathId === null) {
    return {
      walletId: wallet.id,
      possible: false,
      days: 0,
      travelMinutes: 0,
      placeIds: [],
      steps: [],
      unknowns: [],
    }
  }

  const travelOf = (id: Id): number => {
    const location = plan.locations.find((entry) => entry.id === id)
    // An unrecorded travel time is counted as nothing, and said out loud below.
    // Counting it as something would be inventing the number this whole file
    // exists to avoid inventing.
    return location?.travelMinutes ?? 0
  }

  const path = wallet.paths.find((entry) => entry.id === availability.viaPathId)!
  const pathState = availability.paths.find((entry) => entry.pathId === path.id)!

  // Greedy by marginal travel: two keys in one building cost one journey, and
  // picking the individually cheapest key first would miss that.
  const routes = new Map<Id, Route>()
  for (const keyId of pathState.availableKeyIds) {
    const route = keyRoutes(plan, keyId, world, travelOf)
    if (route) routes.set(keyId, route)
  }

  const chosenPlaces = new Set<Id>()
  const chosenKeys: Id[] = []
  const unknownPlaces = new Set<Id>()
  while (chosenKeys.length < path.threshold && routes.size > 0) {
    let best: { keyId: Id; route: Route; price: number } | null = null
    for (const [keyId, route] of routes) {
      const price = marginal(route, chosenPlaces, travelOf)
      if (best === null || price < best.price) best = { keyId, route, price }
    }
    if (best === null) break
    routes.delete(best.keyId)
    chosenKeys.push(best.keyId)
    for (const id of best.route.placeIds) chosenPlaces.add(id)
    for (const id of best.route.unknownPlaceIds) unknownPlaces.add(id)
  }

  // The configuration is a stop of its own for a multisig, and the one people
  // forget to make, so it is costed rather than assumed to be where you are.
  if (isMultisig(wallet)) {
    const copies = wallet.configBackups.filter(
      (backup) =>
        !world.missing.has(backup.id) &&
        placeReachable(world, backup.locationId) &&
        (backup.medium !== 'encrypted-digital' || world.memory)
    )
    const placed = copies.filter((backup) => backup.locationId !== null)
    if (placed.length > 0) {
      const cheapest = [...placed].sort(
        (a, b) =>
          marginal({ placeIds: [a.locationId!], unknownPlaceIds: [] }, chosenPlaces, travelOf) -
          marginal({ placeIds: [b.locationId!], unknownPlaceIds: [] }, chosenPlaces, travelOf)
      )[0]
      chosenPlaces.add(cheapest.locationId!)
      if (
        plan.locations.find((entry) => entry.id === cheapest.locationId)?.travelMinutes === null
      ) {
        unknownPlaces.add(cheapest.locationId!)
      }
    }
  }

  const placeIds = [...chosenPlaces]
  const travelMinutes = placeIds.reduce((total, id) => total + travelOf(id) * 2, 0)
  const travelDays = Math.ceil(travelMinutes / TRAVEL_MINUTES_PER_DAY)

  const steps: TimingStep[] = []

  if (path.timelockDays > 0) {
    steps.push({
      part: 'wait',
      what: `${path.label} unlocks`,
      why: `The path spends only after ${path.timelockDays} days of no movement.`,
      days: path.timelockDays,
      minutes: 0,
    })
  }

  // Waiting on a door. Only the places this route actually opens count.
  for (const id of placeIds) {
    const location = plan.locations.find((entry) => entry.id === id)
    if (!location) continue
    if (world.actor === 'user') continue
    const delays = location.access
      .filter((access) => world.cooperating.has(access.personId))
      .filter((access) => access.condition === 'after-death')
      .map((access) => access.delayDays)
    const worst = delays.length ? Math.max(...delays) : 0
    if (worst > 0) {
      steps.push({
        part: 'wait',
        what: `${location.label} opens`,
        why: `The access recorded for it arrives ${worst} days after death.`,
        days: worst,
        minutes: 0,
      })
    }
  }

  // A person who has to act, and how quickly they said they could.
  if (world.actor !== 'user') {
    for (const personId of world.cooperating) {
      const person = plan.people.find((entry) => entry.id === personId)
      if (!person) continue
      if (person.availability === 'unknown') {
        unknowns.push(`How quickly ${person.label} could act is not recorded.`)
        continue
      }
      const days = AVAILABILITY_DAYS[person.availability] ?? 0
      if (days > 0) {
        steps.push({
          part: 'wait',
          what: `${person.label} is available`,
          why: `Recorded as reachable in ${person.availability}.`,
          days,
          minutes: 0,
        })
      }
    }
  }

  const waitDays = steps.reduce((worst, step) => Math.max(worst, step.days), 0)

  if (travelMinutes > 0) {
    steps.push({
      part: 'travel',
      what: `${placeIds.length} ${placeIds.length === 1 ? 'place' : 'places'}`,
      why: `Door to door and back, over ${placeIds
        .map((id) => plan.locations.find((entry) => entry.id === id)?.label ?? id)
        .join(', ')}.`,
      days: travelDays,
      minutes: travelMinutes,
    })
  }

  for (const id of unknownPlaces) {
    const location = plan.locations.find((entry) => entry.id === id)
    unknowns.push(`How far away ${location?.label ?? id} is has not been recorded.`)
  }
  for (const id of placeIds) {
    const location = plan.locations.find((entry) => entry.id === id)
    if (location && (location.kind === 'bank-vault' || location.kind === 'private-vault')) {
      unknowns.push(`${location.label} opens on somebody else's hours, which are not recorded.`)
    }
  }

  return {
    walletId: wallet.id,
    possible: true,
    days: waitDays + travelDays,
    travelMinutes,
    placeIds,
    steps,
    unknowns,
  }
}

/** Every wallet's timing in one world, in plan order. */
export function recoveryTimings(plan: Plan, world: World): RecoveryTiming[] {
  return plan.wallets.map((wallet) => recoveryTiming(plan, wallet, world))
}

/**
 * The route as a sentence: what is waited for, and what is travelled to. Kept
 * beside the arithmetic so the finding and the interface say the same thing.
 */
export function describeSteps(timing: RecoveryTiming): string {
  const parts: string[] = []
  for (const step of timing.steps) {
    if (step.part === 'wait') {
      parts.push(`waiting ${step.days} days for ${step.what.toLowerCase()}`)
      continue
    }
    const hours = Math.round(step.minutes / 60)
    parts.push(
      `opening ${step.what.toLowerCase()}, ${hours <= 1 ? 'an hour' : `${hours} hours`} of travel in all`
    )
  }
  if (parts.length === 0) return 'nothing but the time it takes to sit down and do it'
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and then ${parts[parts.length - 1]}`
}

export function describeDuration(days: number, travelMinutes: number): string {
  if (days === 0) {
    if (travelMinutes === 0) return 'same day, no travel'
    const hours = Math.round(travelMinutes / 60)
    return hours <= 1
      ? 'same day, about an hour of travel'
      : `same day, about ${hours} hours travel`
  }
  if (days === 1) return 'about a day'
  if (days < 14) return `about ${days} days`
  if (days < 60) return `about ${Math.round(days / 7)} weeks`
  return `about ${Math.round(days / 30)} months`
}
