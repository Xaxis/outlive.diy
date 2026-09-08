/**
 * Recovery routes: one short ordered procedure per way this can go wrong.
 *
 * Each route is computed from the same scenario the findings use, so a route
 * cannot claim a recovery the analysis says is impossible. Where a route does
 * not exist, that is what the document says, and it says which specific thing
 * is missing rather than offering encouragement.
 *
 * The order of the steps is not arbitrary. The wallet configuration comes
 * first, because discovering it is missing after a day of travel is the worst
 * possible time. Distant locations come before near ones, because the near
 * ones will still be there.
 */

import type { Id, Plan } from '../model/types.ts'
import { evaluateKey, evaluateWallet, type World } from '../analysis/availability.ts'
import type { AnalysisContext } from '../analysis/context.ts'
import { isMultisig } from '../model/selectors.ts'
import {
  coercionScenario,
  disasterGroupLostScenario,
  locationCompromisedScenario,
  locationLostScenario,
  objectLostScenario,
  personLostScenario,
  userDeathScenario,
  type Scenario,
} from '../analysis/scenarios.ts'
import { disasterGroups } from '../model/selectors.ts'
import { recoveryTiming, type RecoveryTiming } from '../analysis/timing.ts'

export interface RecoveryStep {
  order: number
  title: string
  detail: string
  /** Where this step happens, when it happens somewhere. */
  locationId: Id | null
}

export interface RecoveryRoute {
  scenarioId: string
  title: string
  /** What has happened, in one sentence. */
  situation: string
  /** What the first hour is for. */
  firstMove: string
  possible: boolean
  walletIds: Id[]
  lostWalletIds: Id[]
  steps: RecoveryStep[]
  /** Why it cannot be done, when it cannot. */
  blockers: string[]
  /**
   * How long the route takes, for the wallet that takes longest. Null when
   * there is nothing to recover. This belongs in the printed document rather
   * than only on screen: somebody reading this on paper, on the day, needs to
   * know whether they are looking at an afternoon or a fortnight before they
   * start.
   */
  timing: RecoveryTiming | null
}

function travelOrder(plan: Plan, locationIds: Id[]): Id[] {
  return [...locationIds].sort((a, b) => {
    const first = plan.locations.find((location) => location.id === a)?.travelMinutes ?? 0
    const second = plan.locations.find((location) => location.id === b)?.travelMinutes ?? 0
    return second - first
  })
}

/** Locations that must be visited to satisfy the wallet's best path in this world. */
function locationsNeeded(plan: Plan, walletId: Id, world: World): Id[] {
  const wallet = plan.wallets.find((entry) => entry.id === walletId)
  if (!wallet) return []
  const availability = evaluateWallet(plan, wallet, world)
  const path = availability.paths.find((entry) => entry.pathId === availability.viaPathId)
  if (!path) return []
  const places = new Set<Id>()
  for (const keyId of path.availableKeyIds.slice(0, path.threshold)) {
    const key = plan.keys.find((entry) => entry.id === keyId)
    if (!key) continue
    const state = evaluateKey(plan, key, world)
    if (state.routes.includes('device') && key.deviceLocationId) {
      places.add(key.deviceLocationId)
      continue
    }
    for (const backup of key.backups) {
      if (backup.locationId && world.reachable.has(backup.locationId)) places.add(backup.locationId)
    }
  }
  return [...places]
}

function configStep(plan: Plan, walletIds: Id[], world: World): RecoveryStep | null {
  const multisig = plan.wallets.filter(
    (wallet) => walletIds.includes(wallet.id) && isMultisig(wallet)
  )
  if (multisig.length === 0) return null
  const places = new Set<Id>()
  for (const wallet of multisig) {
    for (const backup of wallet.configBackups) {
      if (backup.locationId && world.reachable.has(backup.locationId)) places.add(backup.locationId)
    }
  }
  return {
    order: 0,
    title: 'Get the wallet configuration first',
    detail:
      places.size > 0
        ? `A copy is at ${[...places]
            .map((id) => plan.locations.find((location) => location.id === id)?.label ?? id)
            .join(
              ' or '
            )}. Collect it before you collect any key: seeds without the descriptor restore nothing, and finding that out at the end of the journey is the expensive way to learn it.`
        : 'No reachable copy is recorded. If a signing device that stores the wallet configuration survived, read it from there before doing anything else.',
    locationId: [...places][0] ?? null,
  }
}

function buildRoute(
  ctx: AnalysisContext,
  scenario: Scenario,
  situation: string,
  firstMove: string,
  after: string
): RecoveryRoute {
  const { plan } = ctx
  const survivors: Id[] = []
  const lost: Id[] = []
  const blockers = new Set<string>()

  for (const wallet of plan.wallets) {
    const availability = evaluateWallet(plan, wallet, scenario.world)
    if (availability.spendable) survivors.push(wallet.id)
    else {
      lost.push(wallet.id)
      for (const blocker of availability.blockers) blockers.add(`${wallet.label}: ${blocker}`)
    }
  }

  const steps: RecoveryStep[] = []
  const config = configStep(plan, survivors, scenario.world)
  if (config) steps.push(config)

  const places = travelOrder(plan, [
    ...new Set(survivors.flatMap((walletId) => locationsNeeded(plan, walletId, scenario.world))),
  ])
  for (const locationId of places) {
    const location = plan.locations.find((entry) => entry.id === locationId)
    const keys = plan.keys.filter(
      (key) =>
        key.deviceLocationId === locationId ||
        key.backups.some((backup) => backup.locationId === locationId)
    )
    steps.push({
      order: steps.length,
      title: `Collect from ${location?.label ?? 'a location'}`,
      detail: `${keys.map((key) => key.label).join(', ') || 'The material recorded there'}.${
        location?.travelMinutes ? ` About ${location.travelMinutes} minutes away.` : ''
      }${
        location?.requiresUserPresence
          ? ' This place requires the account holder in person, with identification.'
          : ''
      }${
        location?.tamperEvident
          ? ' Check the seal before opening, and record what you find either way.'
          : ''
      }`,
      locationId,
    })
  }

  if (survivors.length > 0) {
    steps.push({
      order: steps.length,
      title: after,
      detail:
        'Sign from the devices you have, to an address you generate on a device you still control. Confirm the destination on the device screen, not on the computer.',
      locationId: null,
    })
    steps.push({
      order: steps.length,
      title: 'Rebuild the redundancy you just spent',
      detail:
        'The plan now has less margin than it had this morning. Re-run the build runbook for whatever was lost, and update this plan to say what is actually true before you forget.',
      locationId: null,
    })
  }

  return {
    scenarioId: scenario.id,
    title: scenario.label,
    situation,
    firstMove,
    possible: survivors.length > 0,
    walletIds: survivors,
    lostWalletIds: lost,
    steps,
    blockers: [...blockers],
    // The slowest survivor, because a route is finished when the last thing on
    // it is finished, not when the first one is.
    timing: survivors
      .map((walletId) =>
        recoveryTiming(
          plan,
          plan.wallets.find((wallet) => wallet.id === walletId)!,
          scenario.world
        )
      )
      .reduce<RecoveryTiming | null>(
        (slowest, timing) => (slowest === null || timing.days > slowest.days ? timing : slowest),
        null
      ),
  }
}

export function recoveryRoutes(ctx: AnalysisContext): RecoveryRoute[] {
  const { plan } = ctx
  const routes: RecoveryRoute[] = []

  for (const location of plan.locations) {
    routes.push(
      buildRoute(
        ctx,
        locationLostScenario(ctx, location.id),
        `${location.label} and everything in it is gone: fire, flood, burglary, or a container you can no longer open.`,
        'Establish what was actually in there, from the plan rather than from memory, and assume every item is compromised as well as lost until you know otherwise.',
        'Move the balance to a new wallet'
      )
    )
  }

  for (const [group, members] of disasterGroups(plan)) {
    if (members.length < 2) continue
    routes.push(
      buildRoute(
        ctx,
        disasterGroupLostScenario(ctx, group),
        `Everything in "${group}" is gone at once: ${members.map((member) => member.label).join(', ')}.`,
        'One event took several places. Work from the assumption that anything in that group is unavailable indefinitely, not temporarily.',
        'Move the balance to a new wallet'
      )
    )
  }

  for (const device of plan.devices) {
    routes.push(
      buildRoute(
        ctx,
        objectLostScenario(ctx, 'device-lost', device.id, device.label),
        `${device.label} is dead, lost, or has failed a firmware update.`,
        'A dead device is not a lost key if the backup is good. Do not buy a replacement in a hurry from a marketplace.',
        'Restore onto a replacement device and re-verify'
      )
    )
  }

  for (const location of plan.locations) {
    routes.push(
      buildRoute(
        ctx,
        locationCompromisedScenario(ctx, location.id),
        `${location.label} has been opened by somebody else. Treat everything that was in it as known to them.`,
        'Speed matters here in a way it does not elsewhere. Move first and investigate afterwards.',
        'Move the balance now, to a wallet built from keys that were never in that place'
      )
    )
  }

  for (const person of plan.people) {
    routes.push(
      buildRoute(
        ctx,
        personLostScenario(ctx, person.id),
        `${person.label} is unreachable, unwilling, or gone.`,
        'Confirm what they held and what they could reach, then close their access before anything else.',
        'Move the balance to a wallet that does not depend on them'
      )
    )
  }

  routes.push(
    buildRoute(
      ctx,
      coercionScenario(ctx),
      'You are being compelled to hand over access, in person, now.',
      'Nothing in this document is a reason to resist. Hand over what is reachable. The plan is judged by what remains out of reach afterwards, and if that is nothing, this is the finding to act on before it happens.',
      'Afterwards, move whatever survived to keys that were never in the room'
    )
  )

  routes.push(
    buildRoute(
      ctx,
      userDeathScenario(ctx, null),
      'The person who built this plan has died. Somebody else is reading it.',
      'Take nothing out of a container without two people present, and write down what was in it before it moves.',
      'Consolidate the balance into a wallet the estate controls'
    )
  )

  return routes
}
