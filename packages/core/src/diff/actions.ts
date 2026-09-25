/**
 * What a change to a plan asks somebody to go and do.
 *
 * The difference between two plans used to be shown as the fields that
 * differed: "key · Key A deviceLocationId, backups". That is true and it is
 * useless to a person standing in their hallway with a steel plate. A fix is
 * only worth anything once it is a list of errands: take this there, copy that,
 * tell somebody something. This turns the one into the other.
 *
 * It describes the plan, and it invents nothing: every sentence is a field
 * that differs between the two, in words. Places and people stay roles.
 */

import type {
  BackupMedium,
  Device,
  Id,
  Key,
  Location,
  Person,
  Plan,
  Wallet,
} from '../model/types.ts'

export type ActionSubject = 'location' | 'person' | 'device' | 'key' | 'wallet' | 'verification'

export interface PlanAction {
  subject: ActionSubject
  /** One sentence, imperative, in the reader's terms. */
  text: string
  /**
   * Something that happens in the world, as opposed to a record of something
   * that already did. A new check being written down is not an errand.
   */
  errand: boolean
}

const MEDIUM: Record<BackupMedium, string> = {
  steel: 'steel',
  paper: 'paper',
  'encrypted-digital': 'an encrypted file',
  'plain-digital': 'a plain file',
  memorized: 'memory',
}

const ROLE: Record<Person['role'], string> = {
  cosigner: 'co-signer',
  successor: 'successor',
  executor: 'executor',
  'key-agent': 'key agent',
  aware: 'person who knows the plan exists',
  professional: 'professional adviser',
}

function hours(minutes: number | null): string | null {
  if (minutes === null) return null
  if (minutes === 0) return 'where you are'
  if (minutes < 60) return `${minutes} minutes away`
  const h = Math.round(minutes / 60)
  return h >= 24 ? `about ${Math.round(h / 24)} days away` : `about ${h}h away`
}

const byId = <T extends { id: Id }>(items: T[]) => new Map(items.map((item) => [item.id, item]))

export function describeActions(before: Plan, after: Plan): PlanAction[] {
  const out: PlanAction[] = []
  const add = (subject: ActionSubject, text: string, errand = true) =>
    out.push({ subject, text, errand })

  const placesBefore = byId(before.locations)
  const placesAfter = byId(after.locations)
  const peopleAfter = byId(after.people)
  const peopleBefore = byId(before.people)
  const devicesAfter = byId(after.devices)
  const devicesBefore = byId(before.devices)
  const place = (id: Id | null) =>
    (id && (placesAfter.get(id) ?? placesBefore.get(id))?.label) ?? 'a place not recorded'
  const person = (id: Id) => (peopleAfter.get(id) ?? peopleBefore.get(id))?.label ?? 'somebody'
  const device = (id: Id | null) =>
    (id && (devicesAfter.get(id) ?? devicesBefore.get(id))?.label) ?? null

  // Places first: the rest of the errands go to them.
  for (const location of after.locations) {
    if (placesBefore.has(location.id)) continue
    const away = hours(location.travelMinutes)
    const alone =
      location.disasterGroup !== null &&
      !after.locations.some(
        (other) => other.id !== location.id && other.disasterGroup === location.disasterGroup
      )
    add(
      'location',
      `Find a new place to keep things, ${location.label}${away ? `, ${away}` : ''}${alone ? ', in a region none of your other places share' : ''}`
    )
  }
  for (const location of before.locations) {
    if (!placesAfter.has(location.id)) add('location', `Stop using ${location.label}`)
  }

  for (const entry of after.people) {
    const was = peopleBefore.get(entry.id)
    if (!was) {
      add('person', `Choose a ${ROLE[entry.role]}, called ${entry.label} in this plan`)
      if (entry.knowsWhereInstructionsAre)
        add('person', `Tell ${entry.label} where the instructions are`)
      continue
    }
    if (entry.knowsWhereInstructionsAre && !was.knowsWhereInstructionsAre)
      add('person', `Tell ${entry.label} where the instructions are`)
    else if (entry.knowsPlanExists && !was.knowsPlanExists)
      add('person', `Tell ${entry.label} that the plan exists`)
  }

  for (const entry of after.devices) {
    if (devicesBefore.has(entry.id)) continue
    add('device', `Get a new signing device${deviceWhat(entry)}, ${entry.label} in this plan`)
  }

  // Access is arranged per place, so it is read from the places that exist in
  // both: a new place's access is part of setting it up.
  for (const location of after.locations) {
    const was = placesBefore.get(location.id)
    if (!was) continue
    for (const access of location.access) {
      if (was.access.some((entry) => entry.personId === access.personId)) continue
      add('location', accessText(person(access.personId), location, access.condition))
    }
  }

  const keysBefore = byId(before.keys)
  for (const key of after.keys) {
    const was = keysBefore.get(key.id)
    if (!was) {
      const on = device(key.deviceId)
      add('key', `Create ${key.label}${on ? ` on ${on}` : ''}`)
      if (key.deviceId && key.deviceLocationId)
        add('key', `Keep ${on ?? `${key.label}'s device`} at ${place(key.deviceLocationId)}`)
      for (const backup of key.backups)
        add(
          'key',
          `Write ${key.label} on ${MEDIUM[backup.medium]} and keep it at ${place(backup.locationId)}`
        )
      continue
    }
    keyChanges(was, key, place, device, add)
  }

  const walletsBefore = byId(before.wallets)
  for (const wallet of after.wallets) {
    const was = walletsBefore.get(wallet.id)
    if (!was) {
      add('wallet', `Set up ${wallet.label} as ${policy(wallet, after)}`)
      continue
    }
    walletChanges(was, wallet, after, place, add)
  }

  const checksBefore = byId(before.verifications)
  for (const check of after.verifications) {
    const was = checksBefore.get(check.id)
    if (check.lastVerifiedAt && check.lastVerifiedAt !== was?.lastVerifiedAt)
      add(
        'verification',
        `Recorded as done on ${check.lastVerifiedAt}: ${check.kind.replace(/-/g, ' ')}`,
        false
      )
    else if (!was) add('verification', `Schedule a check: ${check.kind.replace(/-/g, ' ')}`, false)
  }

  return out
}

function deviceWhat(device: Device): string {
  const what = [device.vendor, device.model].filter(Boolean).join(' ')
  return what ? ` (${what})` : ''
}

function accessText(who: string, location: Location, condition: string): string {
  if (condition === 'after-death')
    return `Arrange for ${who} to be able to open ${location.label} after your death`
  if (condition === 'with-user')
    return `Arrange for ${who} to be able to open ${location.label} with you there`
  return `Give ${who} access to ${location.label}`
}

function keyChanges(
  was: Key,
  key: Key,
  place: (id: Id | null) => string,
  device: (id: Id | null) => string | null,
  add: (subject: ActionSubject, text: string) => void
) {
  if (key.deviceId !== was.deviceId && key.deviceId)
    add('key', `Put ${key.label} on ${device(key.deviceId) ?? 'another device'}`)
  if (key.deviceLocationId !== was.deviceLocationId && key.deviceLocationId) {
    const on = device(key.deviceId) ?? `${key.label}'s device`
    add(
      'key',
      was.deviceLocationId
        ? `Take ${on} from ${place(was.deviceLocationId)} to ${place(key.deviceLocationId)}`
        : `Keep ${on} at ${place(key.deviceLocationId)}`
    )
  }
  const before = byId(was.backups)
  for (const backup of key.backups) {
    const old = before.get(backup.id)
    if (!old) {
      const first = was.backups.length === 0 ? 'a' : 'another'
      add(
        'key',
        `Make ${first} ${MEDIUM[backup.medium]} backup of ${key.label} and keep it at ${place(backup.locationId)}`
      )
    } else if (old.locationId !== backup.locationId) {
      add(
        'key',
        `Move ${key.label}'s ${backup.label.toLowerCase()} from ${place(old.locationId)} to ${place(backup.locationId)}`
      )
    } else if (old.medium !== backup.medium) {
      add('key', `Copy ${key.label} from ${MEDIUM[old.medium]} onto ${MEDIUM[backup.medium]}`)
    }
  }
  for (const backup of was.backups)
    if (!key.backups.some((entry) => entry.id === backup.id))
      add(
        'key',
        `Destroy ${key.label}'s ${backup.label.toLowerCase()} at ${place(backup.locationId)}`
      )
}

function policy(wallet: Wallet, plan: Plan): string {
  const path = wallet.paths[0]
  if (!path) return 'a wallet with no way to spend'
  const labels = path.keyIds
    .map((id) => plan.keys.find((key) => key.id === id)?.label)
    .filter(Boolean)
    .join(', ')
  return `${path.threshold} of ${path.keyIds.length}${labels ? ` (${labels})` : ''}`
}

function walletChanges(
  was: Wallet,
  wallet: Wallet,
  plan: Plan,
  place: (id: Id | null) => string,
  add: (subject: ActionSubject, text: string) => void
) {
  const shape = (target: Wallet) =>
    target.paths.map((path) => `${path.threshold}:${[...path.keyIds].sort().join(',')}`).join('|')
  // A different quorum is a different wallet on chain: the coins move to it.
  if (shape(was) !== shape(wallet))
    add(
      'wallet',
      `Set up ${wallet.label} again as ${policy(wallet, plan)} and move the coins to it`
    )
  const copies = byId(was.configBackups)
  for (const copy of wallet.configBackups) {
    const old = copies.get(copy.id)
    if (!old)
      add('wallet', `Put a copy of ${wallet.label}'s descriptor at ${place(copy.locationId)}`)
    else if (old.locationId !== copy.locationId)
      add(
        'wallet',
        `Move the copy of ${wallet.label}'s descriptor from ${place(old.locationId)} to ${place(copy.locationId)}`
      )
  }
}
