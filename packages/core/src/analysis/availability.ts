/**
 * The availability core.
 *
 * Every analysis in this engine is the same question asked in a different
 * world: given who can reach what, can this wallet be spent? Loss asks it with
 * something removed. Compromise asks it standing in the attacker's shoes.
 * Succession asks it with the user gone. Coercion asks it with the user
 * present and cooperating under duress.
 *
 * Keeping one evaluator means those answers cannot disagree with each other,
 * which matters more than any individual rule: a planner that says a setup
 * survives a fire and also that it does not is worse than one that says
 * nothing.
 */

import type { Backup, Id, Key, Plan, Wallet } from '../model/types.ts'
import { isMultisig, splitGroups, wholeBackups } from '../model/selectors.ts'

/**
 * A world is a positive description of what can be obtained. It never says what
 * is missing; it says what is in reach. Building worlds that way makes the
 * adversary cases honest, because an attacker's world starts empty.
 */
export interface World {
  /** Short human description, used verbatim in findings and recovery routes. */
  label: string
  actor: 'user' | 'successor' | 'adversary'
  /** Places whose contents can be obtained. */
  reachable: ReadonlySet<Id>
  /**
   * Whether objects with no recorded location count as reachable. The user
   * knows where their own things are even when the plan does not record it; an
   * attacker standing in one specific room does not.
   */
  unknownPlacementReachable: boolean
  /** Ids of keys, devices, backups or config backups that are simply gone. */
  missing: ReadonlySet<Id>
  /** Memorised secrets are available: PINs, memorised passphrases, disk passwords. */
  memory: boolean
  /** People whose cooperation is available. */
  cooperating: ReadonlySet<Id>
  /** Days of inactivity, which is what opens a timelocked path. */
  elapsedDays: number
  /** Whether a signing device can be obtained to restore a backup into. */
  canObtainSigner: boolean
}

export interface WorldOverrides extends Partial<
  Omit<World, 'reachable' | 'missing' | 'cooperating'>
> {
  reachable?: Iterable<Id>
  missing?: Iterable<Id>
  cooperating?: Iterable<Id>
}

/**
 * The world as it is: the user alive, present, remembering everything, able to
 * go anywhere. Every scenario is a subtraction from this.
 */
export function baseWorld(plan: Plan, overrides: WorldOverrides = {}): World {
  return {
    label: 'Today, nothing wrong',
    actor: 'user',
    reachable: new Set(overrides.reachable ?? plan.locations.map((l) => l.id)),
    unknownPlacementReachable: overrides.unknownPlacementReachable ?? true,
    missing: new Set(overrides.missing ?? []),
    memory: overrides.memory ?? true,
    cooperating: new Set(overrides.cooperating ?? plan.people.map((p) => p.id)),
    elapsedDays: overrides.elapsedDays ?? 0,
    canObtainSigner: overrides.canObtainSigner ?? true,
    ...(overrides.label ? { label: overrides.label } : {}),
    ...(overrides.actor ? { actor: overrides.actor } : {}),
  }
}

export function withWorld(world: World, overrides: WorldOverrides): World {
  return {
    ...world,
    ...overrides,
    reachable: overrides.reachable ? new Set(overrides.reachable) : world.reachable,
    missing: overrides.missing ? new Set(overrides.missing) : world.missing,
    cooperating: overrides.cooperating ? new Set(overrides.cooperating) : world.cooperating,
  }
}

/** Remove things from a world without rebuilding it. */
export function without(
  world: World,
  removals: { locations?: Iterable<Id>; objects?: Iterable<Id>; people?: Iterable<Id> }
): World {
  const reachable = new Set(world.reachable)
  for (const id of removals.locations ?? []) reachable.delete(id)
  const missing = new Set(world.missing)
  for (const id of removals.objects ?? []) missing.add(id)
  const cooperating = new Set(world.cooperating)
  for (const id of removals.people ?? []) cooperating.delete(id)
  return { ...world, reachable, missing, cooperating }
}

function placeReachable(world: World, locationId: Id | null): boolean {
  if (locationId === null) return world.unknownPlacementReachable
  return world.reachable.has(locationId)
}

/** Whether anyone cooperating in this world knows a given secret. */
function someoneKnows(world: World, knownBy: readonly Id[]): boolean {
  return knownBy.some((personId) => world.cooperating.has(personId))
}

/**
 * A backup that is a physical object in a place is available when that place is
 * reachable. Two media break that rule and both matter.
 *
 * `memorized` is not in a place at all, so it needs the memory that holds it.
 * `encrypted-digital` is in a place but is inert without the password, and the
 * password is not modelled as an object anywhere, so it is treated as living in
 * the same memory. That is deliberately unflattering: it is exactly why an
 * encrypted archive is a poor inheritance backup.
 */
function backupAvailable(world: World, backup: Backup): boolean {
  if (world.missing.has(backup.id)) return false
  if (backup.medium === 'memorized') return world.memory
  if (!placeReachable(world, backup.locationId)) return false
  if (backup.medium === 'encrypted-digital') return world.memory
  return true
}

export type KeyRoute = 'device' | 'backup'

export interface KeyAvailability {
  keyId: Id
  usable: boolean
  routes: KeyRoute[]
  /** Plain-language reasons it is not usable, in the order they bite. */
  blockers: string[]
}

/** Whether the device belonging to a key can be picked up and unlocked. */
function deviceRoute(plan: Plan, key: Key, world: World): { ok: boolean; blocker: string | null } {
  if (!key.deviceId) return { ok: false, blocker: null }
  const device = plan.devices.find((d) => d.id === key.deviceId)
  if (!device) return { ok: false, blocker: null }
  if (world.missing.has(device.id)) return { ok: false, blocker: `${device.label} is gone` }
  if (!placeReachable(world, key.deviceLocationId)) {
    return { ok: false, blocker: `${device.label} cannot be reached` }
  }
  const pin = device.pin
  if (pin.storage === 'none') return { ok: true, blocker: null }
  const unlocked =
    world.memory ||
    someoneKnows(world, pin.knownBy) ||
    (pin.storage === 'written' && placeReachable(world, pin.locationId))
  if (!unlocked) return { ok: false, blocker: `${device.label} cannot be unlocked` }
  return { ok: true, blocker: null }
}

/** Whether the key's secret can be rebuilt from what is written down. */
function backupRoute(key: Key, world: World): { ok: boolean; blocker: string | null } {
  if (key.backups.length === 0) return { ok: false, blocker: null }
  if (!world.canObtainSigner) return { ok: false, blocker: 'no device to restore into' }
  if (wholeBackups(key).some((backup) => backupAvailable(world, backup))) {
    return { ok: true, blocker: null }
  }
  for (const [, group] of splitGroups(key)) {
    const have = group.shares.filter((share) => backupAvailable(world, share)).length
    if (have >= group.threshold) return { ok: true, blocker: null }
  }
  return { ok: false, blocker: `${key.label}: no backup within reach` }
}

/**
 * A passphrase gates both routes. A hardware wallet asks for it on every
 * unlock, and a restored seed without it lands on an empty wallet, which is the
 * failure that looks most like theft and is not.
 */
function passphraseAvailable(key: Key, world: World): boolean {
  const passphrase = key.passphrase
  if (!passphrase.enabled) return true
  if (world.memory) return true
  if (someoneKnows(world, passphrase.knownBy)) return true
  const reachable = passphrase.locationIds.filter((id) => placeReachable(world, id)).length
  if (passphrase.storage === 'written') return reachable > 0
  if (passphrase.storage === 'split') return reachable >= (passphrase.splitThreshold ?? 1)
  return false
}

export function evaluateKey(plan: Plan, key: Key, world: World): KeyAvailability {
  const blockers: string[] = []
  if (world.missing.has(key.id)) {
    return { keyId: key.id, usable: false, routes: [], blockers: [`${key.label} is gone`] }
  }
  if (key.heldBy !== null && !world.cooperating.has(key.heldBy)) {
    const holder = plan.people.find((p) => p.id === key.heldBy)
    return {
      keyId: key.id,
      usable: false,
      routes: [],
      blockers: [`${key.label} is held by ${holder?.label ?? 'someone unavailable'}`],
    }
  }

  const routes: KeyRoute[] = []
  const viaDevice = deviceRoute(plan, key, world)
  if (viaDevice.ok) routes.push('device')
  else if (viaDevice.blocker) blockers.push(viaDevice.blocker)

  const viaBackup = backupRoute(key, world)
  if (viaBackup.ok) routes.push('backup')
  else if (viaBackup.blocker) blockers.push(viaBackup.blocker)

  if (routes.length === 0) {
    if (blockers.length === 0) blockers.push(`${key.label} has nothing to sign with`)
    return { keyId: key.id, usable: false, routes, blockers }
  }

  if (!passphraseAvailable(key, world)) {
    return {
      keyId: key.id,
      usable: false,
      routes,
      blockers: [`${key.label}: the passphrase is out of reach`],
    }
  }

  return { keyId: key.id, usable: true, routes, blockers: [] }
}

export interface PathAvailability {
  pathId: Id
  label: string
  /** Whether the timelock has elapsed in this world. */
  open: boolean
  threshold: number
  availableKeyIds: Id[]
  satisfied: boolean
  /** Spare keys beyond the threshold. Negative when short. */
  margin: number
}

export interface WalletAvailability {
  walletId: Id
  spendable: boolean
  /** Multisig without its descriptor is not a wallet, only a pile of seeds. */
  configAvailable: boolean
  viaPathId: Id | null
  paths: PathAvailability[]
  /** Spare capacity on the best satisfied path. Zero means the next loss is fatal. */
  margin: number
  blockers: string[]
}

/**
 * Whether the wallet's descriptor can be recovered. A device counts only if it
 * both stores the configuration and can be unlocked, because reading it off a
 * locked signer is not a thing.
 */
export function configAvailable(plan: Plan, wallet: Wallet, world: World): boolean {
  if (!isMultisig(wallet)) return true
  for (const backup of wallet.configBackups) {
    if (world.missing.has(backup.id)) continue
    if (backup.medium === 'memorized') {
      if (world.memory) return true
      continue
    }
    if (!placeReachable(world, backup.locationId)) continue
    if (backup.medium === 'encrypted-digital' && !world.memory) continue
    return true
  }
  for (const path of wallet.paths) {
    for (const keyId of path.keyIds) {
      const key = plan.keys.find((k) => k.id === keyId)
      if (!key?.deviceId) continue
      const device = plan.devices.find((d) => d.id === key.deviceId)
      if (!device?.storesWalletConfig) continue
      if (deviceRoute(plan, key, world).ok) return true
    }
  }
  return false
}

export function evaluateWallet(plan: Plan, wallet: Wallet, world: World): WalletAvailability {
  const keyState = new Map<Id, KeyAvailability>()
  for (const key of plan.keys) keyState.set(key.id, evaluateKey(plan, key, world))

  const paths: PathAvailability[] = wallet.paths.map((path) => {
    const open = world.elapsedDays >= path.timelockDays
    const availableKeyIds = path.keyIds.filter((keyId) => keyState.get(keyId)?.usable)
    const satisfied = open && availableKeyIds.length >= path.threshold
    return {
      pathId: path.id,
      label: path.label,
      open,
      threshold: path.threshold,
      availableKeyIds,
      satisfied,
      margin: availableKeyIds.length - path.threshold,
    }
  })

  const config = configAvailable(plan, wallet, world)
  const satisfiedPaths = paths.filter((path) => path.satisfied)
  const best = satisfiedPaths.reduce<PathAvailability | null>(
    (winner, path) => (winner === null || path.margin > winner.margin ? path : winner),
    null
  )

  const blockers: string[] = []
  if (!config) blockers.push('the wallet configuration cannot be recovered')
  if (best === null) {
    for (const path of paths) {
      if (!path.open) {
        blockers.push(`${path.label} has not unlocked yet`)
        continue
      }
      const short = path.threshold - path.availableKeyIds.length
      blockers.push(`${path.label} is ${short} ${short === 1 ? 'key' : 'keys'} short`)
    }
    if (wallet.paths.length === 0) blockers.push('the wallet has no way to spend at all')
  }

  return {
    walletId: wallet.id,
    spendable: config && best !== null,
    configAvailable: config,
    viaPathId: best?.pathId ?? null,
    paths,
    margin: best?.margin ?? -1,
    blockers,
  }
}

export function evaluatePlan(plan: Plan, world: World): Map<Id, WalletAvailability> {
  return new Map(plan.wallets.map((wallet) => [wallet.id, evaluateWallet(plan, wallet, world)]))
}

/** The set of keys an actor in this world could sign with. */
export function usableKeys(plan: Plan, world: World): Key[] {
  return plan.keys.filter((key) => evaluateKey(plan, key, world).usable)
}
