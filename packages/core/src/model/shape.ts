/**
 * A whole plan from its shape.
 *
 * Describing a setup field by field is seven forms and a hundred decisions,
 * most of which are the same decision for every key. What actually varies
 * between one person's plan and the next is small: how many keys and how many
 * to spend, which places, what sits where, and whether somebody else holds a
 * key or inherits. So those are the inputs, and the plan is derived from them:
 * a device and a backup per key, a copy of the wallet configuration wherever
 * it is asked for, a successor who can open one place after you, and a check
 * scheduled for everything that can be checked.
 *
 * Nothing here decides anything the analysis then grades. The result is an
 * ordinary plan, edited like any other, and every finding about it is the
 * engine's, not this file's.
 */

import type { Key, LocationKind, Person, Plan, Verification } from './types.ts'
import {
  createBackup,
  createConfigBackup,
  createDevice,
  createKey,
  createLocation,
  createPerson,
  createPlan,
  createSpendPath,
  createVerification,
  createWallet,
} from './factory.ts'

export interface ShapePlace {
  kind: LocationKind
  /** Minutes door to door from where you usually are. */
  travelMinutes: number
  /** Far enough away that one fire, flood or court order does not reach both. */
  far: boolean
}

export interface KeyPlacement {
  /** Index into `places` where the signing device is kept, or null for none. */
  device: number | null
  /** Index into `places` where the backup is kept, or null for none. */
  backup: number | null
}

export interface Shape {
  name: string
  threshold: number
  keys: number
  /** The last key is held by a cosigning company rather than by you. */
  collaborative: boolean
  places: ShapePlace[]
  placement: KeyPlacement[]
  /** Places holding a copy of the wallet configuration. Multisig only. */
  configPlaces: number[]
  /** A successor, and the place they can open after your death, or null. */
  successorPlace: number | null
  /** A small single-key wallet on a phone, for spending. */
  hotWallet: boolean
}

/** What each kind of place usually is, when nothing else is known. */
export const PLACE_DEFAULTS: Record<LocationKind, { travelMinutes: number; far: boolean }> = {
  home: { travelMinutes: 0, far: false },
  'second-home': { travelMinutes: 180, far: true },
  workplace: { travelMinutes: 30, far: false },
  'bank-vault': { travelMinutes: 30, far: false },
  'private-vault': { travelMinutes: 60, far: false },
  'trusted-person': { travelMinutes: 240, far: true },
  concealed: { travelMinutes: 15, far: false },
  'on-person': { travelMinutes: 0, far: false },
  other: { travelMinutes: 60, far: false },
}

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** "Site A", "Site B". Places are roles, never addresses. */
export const placeLabel = (index: number) => `Site ${LETTERS[index] ?? index + 1}`
export const keyLabel = (index: number) => `Key ${LETTERS[index] ?? index + 1}`

/**
 * A placement that spreads things out: each key's device and its backup in
 * different places, and consecutive keys starting in different places. Not
 * optimal for every plan, which is what the analysis is for, but never the
 * obvious mistake of a key and its only backup in one room.
 */
export function spreadPlacement(
  keys: number,
  places: number,
  collaborative: boolean
): KeyPlacement[] {
  return Array.from({ length: keys }, (_, index) => {
    if (collaborative && index === keys - 1) return { device: null, backup: null }
    if (places === 0) return { device: null, backup: null }
    const device = index % places
    const backup = places > 1 ? (index + 1) % places : device
    return { device, backup }
  })
}

export function defaultShape(): Shape {
  const places: ShapePlace[] = [
    { kind: 'home', ...PLACE_DEFAULTS.home },
    { kind: 'bank-vault', ...PLACE_DEFAULTS['bank-vault'] },
    { kind: 'trusted-person', ...PLACE_DEFAULTS['trusted-person'] },
  ]
  return {
    name: 'My plan',
    threshold: 2,
    keys: 3,
    collaborative: false,
    places,
    placement: spreadPlacement(3, places.length, false),
    configPlaces: [0, 1, 2],
    successorPlace: 2,
    hotWallet: false,
  }
}

export function planFromShape(shape: Shape): Plan {
  const places = shape.places.map((place, index) =>
    createLocation({
      label: placeLabel(index),
      kind: place.kind,
      travelMinutes: place.travelMinutes,
      // Everything not far shares one area, and each far place is its own.
      disasterGroup: place.far ? `Area ${LETTERS[index]}` : 'Home area',
      requiresUserPresence: place.kind === 'bank-vault',
      tamperEvident: place.kind === 'bank-vault' || place.kind === 'private-vault',
    })
  )
  const at = (index: number | null) => (index === null ? null : (places[index]?.id ?? null))

  const people: Person[] = []
  let service: Person | null = null
  if (shape.collaborative) {
    service = createPerson({
      label: 'Cosigning service',
      role: 'professional',
      technicalSkill: 'expert',
      knowsPlanExists: true,
      availability: 'days',
    })
    people.push(service)
  }
  if (shape.successorPlace !== null && places[shape.successorPlace]) {
    const successor = createPerson({
      label: 'Successor 1',
      role: 'successor',
      technicalSkill: 'basic',
      knowsPlanExists: true,
      availability: 'days',
    })
    people.push(successor)
    const place = places[shape.successorPlace]
    place.access = [{ personId: successor.id, condition: 'after-death', delayDays: 0 }]
    if (place.kind === 'trusted-person') place.custodianId = successor.id
  }

  const devices: Plan['devices'] = []
  const keys: Key[] = []
  const count = Math.max(1, shape.keys)
  for (let index = 0; index < count; index += 1) {
    const placement = shape.placement[index] ?? { device: null, backup: null }
    if (service && index === count - 1) {
      keys.push(createKey({ label: keyLabel(index), heldBy: service.id }))
      continue
    }
    const device =
      placement.device !== null
        ? createDevice({ label: `Signer ${LETTERS[index]}`, supplyChain: 'direct-from-vendor' })
        : null
    if (device) devices.push(device)
    keys.push(
      createKey({
        label: keyLabel(index),
        deviceId: device?.id ?? null,
        deviceLocationId: device ? at(placement.device) : null,
        backups:
          placement.backup !== null
            ? [
                createBackup({
                  label: 'Steel plate',
                  medium: 'steel',
                  locationId: at(placement.backup),
                }),
              ]
            : [],
      })
    )
  }

  const threshold = Math.min(Math.max(1, shape.threshold), keys.length)
  const multisig = keys.length > 1
  const vault = createWallet({
    label: 'Vault',
    tier: 'vault',
    stake: 'large',
    paths: [
      createSpendPath({
        label: 'Everyday',
        kind: 'primary',
        threshold,
        keyIds: keys.map((key) => key.id),
      }),
    ],
    configBackups: multisig
      ? shape.configPlaces
          .filter((index) => places[index])
          .map((index) =>
            createConfigBackup({
              label: `Descriptor at ${placeLabel(index)}`,
              locationId: at(index),
            })
          )
      : [],
  })
  const wallets = [vault]

  if (shape.hotWallet && places.length > 0) {
    const phone = createDevice({ label: 'Phone', kind: 'mobile-wallet' })
    devices.push(phone)
    const hot = createKey({
      label: 'Key H',
      deviceId: phone.id,
      deviceLocationId: places[0].id,
      backups: [createBackup({ label: 'Paper', medium: 'paper', locationId: places[0].id })],
    })
    keys.push(hot)
    wallets.push(
      createWallet({
        label: 'Daily',
        tier: 'hot',
        stake: 'small',
        paths: [createSpendPath({ label: 'Phone', threshold: 1, keyIds: [hot.id] })],
      })
    )
  }

  // Everything that can be checked is put on a schedule, never done. A plan
  // arrives with its checks listed and none of them passed, which is the
  // truth about a plan nobody has tested.
  const verifications: Verification[] = [
    ...keys
      .filter((key) => key.backups.length > 0)
      .map((key) =>
        createVerification({ kind: 'backup-restore', subject: { type: 'key', id: key.id } })
      ),
    ...wallets.map((wallet) =>
      createVerification({ kind: 'spend-test', subject: { type: 'wallet', id: wallet.id } })
    ),
    ...(multisig && vault.configBackups.length > 0
      ? [
          createVerification({
            kind: 'config-backup-restore',
            subject: { type: 'wallet', id: vault.id },
          }),
        ]
      : []),
    ...people
      .filter((person) => person.role === 'successor')
      .map((person) =>
        createVerification({
          kind: 'successor-dry-run',
          subject: { type: 'person', id: person.id },
        })
      ),
  ]

  return createPlan({
    name: shape.name.trim() || 'My plan',
    locations: places,
    people,
    devices,
    keys,
    wallets,
    verifications,
  })
}
