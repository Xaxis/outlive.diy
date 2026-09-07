/**
 * Derived reads over a plan.
 *
 * Nothing here decides anything. These are the lookups the analyses and the
 * documents share, kept in one place so that "which keys does this wallet
 * depend on" has exactly one answer.
 */

import type { Backup, Device, Id, Key, Location, Person, Plan, Wallet } from './types.ts'

export type Index<T> = ReadonlyMap<Id, T>

export interface PlanIndex {
  locations: Index<Location>
  people: Index<Person>
  devices: Index<Device>
  keys: Index<Key>
  wallets: Index<Wallet>
  /** Every backup in the plan, by backup id, with the key it belongs to. */
  backups: ReadonlyMap<Id, { backup: Backup; key: Key }>
}

function byId<T extends { id: Id }>(items: readonly T[]): Index<T> {
  return new Map(items.map((item) => [item.id, item]))
}

export function indexPlan(plan: Plan): PlanIndex {
  const backups = new Map<Id, { backup: Backup; key: Key }>()
  for (const key of plan.keys) {
    for (const backup of key.backups) backups.set(backup.id, { backup, key })
  }
  return {
    locations: byId(plan.locations),
    people: byId(plan.people),
    devices: byId(plan.devices),
    keys: byId(plan.keys),
    wallets: byId(plan.wallets),
    backups,
  }
}

/** Every key any spend path of the wallet can use. */
export function walletKeyIds(wallet: Wallet): Id[] {
  const seen = new Set<Id>()
  for (const path of wallet.paths) for (const keyId of path.keyIds) seen.add(keyId)
  return [...seen]
}

/** Wallets that can spend with this key, in any path. */
export function walletsUsingKey(plan: Plan, keyId: Id): Wallet[] {
  return plan.wallets.filter((wallet) => walletKeyIds(wallet).includes(keyId))
}

/** A wallet is multisig when any path needs more than one key to sign. */
export function isMultisig(wallet: Wallet): boolean {
  return wallet.paths.some((path) => path.threshold > 1 || path.keyIds.length > 1)
}

/** Every place a key's material or unlock secret can be found. */
export function keyLocationIds(plan: Plan, key: Key): Id[] {
  const places = new Set<Id>()
  if (key.deviceLocationId) places.add(key.deviceLocationId)
  for (const backup of key.backups) if (backup.locationId) places.add(backup.locationId)
  for (const locationId of key.passphrase.locationIds) places.add(locationId)
  const device = key.deviceId ? plan.devices.find((d) => d.id === key.deviceId) : undefined
  if (device?.pin.locationId) places.add(device.pin.locationId)
  return [...places]
}

export function disasterGroups(plan: Plan): Map<string, Location[]> {
  const groups = new Map<string, Location[]>()
  for (const location of plan.locations) {
    if (location.disasterGroup === null) continue
    const existing = groups.get(location.disasterGroup)
    if (existing) existing.push(location)
    else groups.set(location.disasterGroup, [location])
  }
  return groups
}

/** Locations a person can get into without the user, and after how long. */
export function locationsReachableBy(
  plan: Plan,
  personId: Id,
  condition: 'always' | 'after-death'
): { location: Location; delayDays: number }[] {
  const out: { location: Location; delayDays: number }[] = []
  for (const location of plan.locations) {
    for (const access of location.access) {
      if (access.personId !== personId) continue
      if (access.condition === 'with-user') continue
      if (condition === 'always' && access.condition !== 'always') continue
      out.push({ location, delayDays: access.delayDays })
    }
  }
  return out
}

export function devicesByVendor(plan: Plan): Map<string, Device[]> {
  const groups = new Map<string, Device[]>()
  for (const device of plan.devices) {
    if (!device.vendor) continue
    const key = device.vendor.trim().toLowerCase()
    const existing = groups.get(key)
    if (existing) existing.push(device)
    else groups.set(key, [device])
  }
  return groups
}

export function devicesByArchitecture(plan: Plan): Map<string, Device[]> {
  const groups = new Map<string, Device[]>()
  for (const device of plan.devices) {
    if (!device.architecture) continue
    const key = device.architecture.trim().toLowerCase()
    const existing = groups.get(key)
    if (existing) existing.push(device)
    else groups.set(key, [device])
  }
  return groups
}

/** Backups of one key that belong to the same Shamir split. */
export function splitGroups(key: Key): Map<string, { threshold: number; shares: Backup[] }> {
  const groups = new Map<string, { threshold: number; shares: Backup[] }>()
  for (const backup of key.backups) {
    if (!backup.split) continue
    const existing = groups.get(backup.split.groupId)
    if (existing) existing.shares.push(backup)
    else groups.set(backup.split.groupId, { threshold: backup.split.threshold, shares: [backup] })
  }
  return groups
}

export function wholeBackups(key: Key): Backup[] {
  return key.backups.filter((backup) => backup.split === null)
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}
