/**
 * Starting points for each step of describing a plan.
 *
 * Most of what goes into a step is the same for most people: a home, a bank
 * box and a relative; a successor who knows the plan exists; a signer from
 * each of three makers; one key per signer with a steel backup; a two of
 * three vault. Typing that in field by field is the part of describing a plan
 * that teaches nothing. A preset puts the usual answer in with one click, and
 * the reader edits the one thing that is different about theirs.
 *
 * Every preset adds; none replaces or deletes. A preset applied to a plan that
 * already has places adds more places, labelled after the ones that exist,
 * because silently rewriting what somebody described is worse than a
 * duplicate they can remove.
 *
 * Makers here are names, as in the device picker, and claim nothing about the
 * devices. Places and people are roles, like everywhere else.
 */

import type {
  Concern,
  Device,
  DeviceKind,
  Id,
  Location,
  LocationKind,
  Plan,
  Verification,
  VerificationKind,
} from './types.ts'
import {
  createBackup,
  createConfigBackup,
  createDevice,
  createKey,
  createLocation,
  createPerson,
  createSpendPath,
  createVerification,
  createWallet,
} from './factory.ts'

export type PresetStep =
  'profile' | 'locations' | 'people' | 'devices' | 'keys' | 'wallets' | 'checks'

export interface Preset {
  id: string
  step: PresetStep
  label: string
  /** What it adds, in one line. */
  detail: string
  /** Why it cannot be used yet, or null when it can. */
  blocked: (plan: Plan) => string | null
  apply: (plan: Plan) => void
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function next(taken: string[], stem: string): string {
  for (const letter of LETTERS) if (!taken.includes(`${stem} ${letter}`)) return `${stem} ${letter}`
  return `${stem} ${taken.length + 1}`
}

function nextNumber(taken: string[], stem: string): string {
  for (let index = 1; index < 100; index += 1)
    if (!taken.includes(`${stem} ${index}`)) return `${stem} ${index}`
  return `${stem} ${taken.length + 1}`
}

interface PlaceSpec {
  kind: LocationKind
  travelMinutes: number
  /** Null for the home area, or a name for a region of its own. */
  region: string | null
}

function addPlaces(plan: Plan, specs: PlaceSpec[]): Location[] {
  const added: Location[] = []
  for (const spec of specs) {
    const label = next(
      plan.locations.map((entry) => entry.label),
      'Site'
    )
    const location = createLocation({
      label,
      kind: spec.kind,
      travelMinutes: spec.travelMinutes,
      disasterGroup: spec.region ?? 'Home area',
      requiresUserPresence: spec.kind === 'bank-vault',
      tamperEvident: spec.kind === 'bank-vault' || spec.kind === 'private-vault',
    })
    plan.locations.push(location)
    added.push(location)
  }
  return added
}

function addDevices(
  plan: Plan,
  specs: { vendor: string; model: string; kind?: DeviceKind; airGapped?: boolean }[]
): Device[] {
  return specs.map((spec) => {
    // Named for what it is, which is what the reader will see on the shelf,
    // and numbered only when the plan already has one of the same.
    const base = spec.model.startsWith(spec.vendor) ? spec.model : `${spec.vendor} ${spec.model}`
    const taken = new Set(plan.devices.map((entry) => entry.label))
    let label = base
    for (let index = 2; taken.has(label); index += 1) label = `${base} ${index}`
    const device = createDevice({
      label,
      vendor: spec.vendor,
      model: spec.model,
      kind: spec.kind ?? 'hardware-signer',
      airGapped: spec.airGapped ?? false,
      supplyChain: 'direct-from-vendor',
    })
    plan.devices.push(device)
    return device
  })
}

function addCheck(plan: Plan, kind: VerificationKind, subject: Verification['subject']): boolean {
  if (plan.verifications.some((entry) => entry.kind === kind && entry.subject.id === subject.id))
    return false
  plan.verifications.push(createVerification({ kind, subject }))
  return true
}

/** Keys not held by somebody else, in the order they were described. */
const ownKeys = (plan: Plan) => plan.keys.filter((key) => !key.heldBy)

function vault(plan: Plan, threshold: number, count: number, label: string): void {
  const keys = ownKeys(plan).slice(0, count)
  const wallet = createWallet({
    label,
    tier: 'vault',
    stake: 'large',
    paths: [
      createSpendPath({
        label: 'Everyday',
        threshold,
        keyIds: keys.map((key) => key.id),
      }),
    ],
    // A copy of the descriptor wherever one of its keys lives, which is
    // the least that makes a quorum of keys a quorum of a wallet.
    configBackups: [
      ...new Set(
        keys.flatMap((key) => [
          key.deviceLocationId,
          ...key.backups.map((backup) => backup.locationId),
        ])
      ),
    ]
      .filter((id): id is Id => id !== null)
      .map((id) =>
        createConfigBackup({
          label: `Descriptor at ${plan.locations.find((entry) => entry.id === id)?.label ?? 'a place'}`,
          locationId: id,
        })
      ),
  })
  plan.wallets.push(wallet)
}

function profile(concerns: Concern[], patch: Partial<Plan['profile']>) {
  return (plan: Plan) => {
    plan.profile = { ...plan.profile, ...patch, concerns }
  }
}

const never = () => null

export const PRESETS: Preset[] = [
  // --- purpose -------------------------------------------------------------
  {
    id: 'profile-saver',
    step: 'profile',
    label: 'Long-term saver',
    detail: 'Loss, theft, fire and death; a month to recover; thirty years.',
    blocked: never,
    apply: profile(['loss', 'theft', 'fire-flood', 'death'], {
      recoveryToleranceDays: 30,
      horizonYears: 30,
      jurisdictionCount: 1,
      travelsFrequently: false,
    }),
  },
  {
    id: 'profile-family',
    step: 'profile',
    label: 'For my family after me',
    detail: 'Death and incapacity first; a few months is fine; past your own life.',
    blocked: never,
    apply: profile(['death', 'incapacity', 'loss', 'fire-flood'], {
      recoveryToleranceDays: 120,
      horizonYears: 50,
    }),
  },
  {
    id: 'profile-traveller',
    step: 'profile',
    label: 'I travel a lot',
    detail: 'Coercion and theft first; a week to recover; away often.',
    blocked: never,
    apply: profile(['coercion', 'theft', 'loss'], {
      recoveryToleranceDays: 7,
      travelsFrequently: true,
    }),
  },
  {
    id: 'profile-everything',
    step: 'profile',
    label: 'Every threat',
    detail: 'Every concern named, two legal systems, fifty years.',
    blocked: never,
    apply: profile(
      [
        'loss',
        'theft',
        'coercion',
        'fire-flood',
        'death',
        'incapacity',
        'legal-seizure',
        'insider',
        'supply-chain',
      ],
      { jurisdictionCount: 2, horizonYears: 50 }
    ),
  },

  // --- places --------------------------------------------------------------
  {
    id: 'places-three-regions',
    step: 'locations',
    label: 'Home, a relative, a second home',
    detail: 'Three places in three regions: no one disaster reaches two.',
    blocked: never,
    apply: (plan) => {
      addPlaces(plan, [
        { kind: 'home', travelMinutes: 0, region: null },
        { kind: 'trusted-person', travelMinutes: 240, region: 'Relative' },
        { kind: 'second-home', travelMinutes: 180, region: 'Second home' },
      ])
    },
  },
  {
    id: 'places-home-bank-relative',
    step: 'locations',
    label: 'Home, a bank box, a relative',
    detail: 'The common three. Home and bank share a city.',
    blocked: never,
    apply: (plan) => {
      addPlaces(plan, [
        { kind: 'home', travelMinutes: 0, region: null },
        { kind: 'bank-vault', travelMinutes: 30, region: null },
        { kind: 'trusted-person', travelMinutes: 240, region: 'Relative' },
      ])
    },
  },
  {
    id: 'places-home-bank',
    step: 'locations',
    label: 'Home and a bank box',
    detail: 'Two places in one city.',
    blocked: never,
    apply: (plan) => {
      addPlaces(plan, [
        { kind: 'home', travelMinutes: 0, region: null },
        { kind: 'bank-vault', travelMinutes: 30, region: null },
      ])
    },
  },

  // --- people --------------------------------------------------------------
  {
    id: 'people-successor',
    step: 'people',
    label: 'A successor',
    detail: 'One person who inherits, knows the plan exists, and can open every place after you.',
    blocked: never,
    apply: (plan) => {
      const person = createPerson({
        label: nextNumber(
          plan.people.map((entry) => entry.label),
          'Successor'
        ),
        role: 'successor',
        technicalSkill: 'basic',
        knowsPlanExists: true,
        availability: 'days',
      })
      plan.people.push(person)
      // Every place, after you: an heir who can open one place of three
      // reaches one key of a two of three, which is no inheritance at all.
      for (const location of plan.locations)
        location.access.push({ personId: person.id, condition: 'after-death', delayDays: 0 })
    },
  },
  {
    id: 'people-successor-executor',
    step: 'people',
    label: 'A successor and an executor',
    detail: 'An heir, and a professional who handles the estate but holds nothing.',
    blocked: never,
    apply: (plan) => {
      const successor = createPerson({
        label: nextNumber(
          plan.people.map((entry) => entry.label),
          'Successor'
        ),
        role: 'successor',
        technicalSkill: 'basic',
        knowsPlanExists: true,
        availability: 'days',
      })
      const executor = createPerson({
        label: nextNumber(
          plan.people.map((entry) => entry.label),
          'Executor'
        ),
        role: 'executor',
        technicalSkill: 'none',
        knowsPlanExists: true,
        availability: 'weeks',
      })
      plan.people.push(successor, executor)
      for (const location of plan.locations)
        location.access.push({ personId: successor.id, condition: 'after-death', delayDays: 0 })
    },
  },

  // --- devices -------------------------------------------------------------
  {
    id: 'devices-three-makers',
    step: 'devices',
    label: 'Three signers, three makers',
    detail: 'Coinkite, Trezor and Foundation: no single maker can sign alone.',
    blocked: never,
    apply: (plan) => {
      addDevices(plan, [
        { vendor: 'Coinkite', model: 'Coldcard Mk4' },
        { vendor: 'Trezor', model: 'Safe 3' },
        { vendor: 'Foundation', model: 'Passport', kind: 'air-gapped-signer', airGapped: true },
      ])
    },
  },
  {
    id: 'devices-one-signer',
    step: 'devices',
    label: 'One hardware signer',
    detail: 'A single signer for a single key.',
    blocked: never,
    apply: (plan) => {
      addDevices(plan, [{ vendor: 'Trezor', model: 'Safe 3' }])
    },
  },
  {
    id: 'devices-phone',
    step: 'devices',
    label: 'A phone for spending',
    detail: 'A phone wallet, for a small everyday balance.',
    blocked: never,
    apply: (plan) => {
      addDevices(plan, [{ vendor: 'BlueWallet', model: 'BlueWallet', kind: 'mobile-wallet' }])
    },
  },

  // --- keys ----------------------------------------------------------------
  {
    id: 'keys-per-device',
    step: 'keys',
    label: 'A key on every signer, backed up on steel',
    detail:
      'One key per device that has none. Each key and its backup share a place, and each key gets a place of its own.',
    blocked: (plan) =>
      plan.devices.length === 0
        ? 'Add devices first.'
        : plan.devices.every((device) => plan.keys.some((key) => key.deviceId === device.id))
          ? 'Every device already has a key.'
          : null,
    apply: (plan) => {
      const free = plan.devices.filter(
        (device) => !plan.keys.some((key) => key.deviceId === device.id)
      )
      free.forEach((device, index) => {
        const offset = ownKeys(plan).length
        const place = plan.locations.length
          ? plan.locations[(offset + index) % plan.locations.length].id
          : null
        plan.keys.push(
          createKey({
            label: next(
              plan.keys.map((entry) => entry.label),
              'Key'
            ),
            deviceId: device.id,
            deviceLocationId: place,
            backups: [createBackup({ label: 'Steel plate', medium: 'steel', locationId: place })],
          })
        )
      })
    },
  },

  // --- wallets -------------------------------------------------------------
  {
    id: 'wallets-two-of-three',
    step: 'wallets',
    label: 'A two of three vault',
    detail: 'Your first three keys, any two to spend, with the descriptor wherever a key lives.',
    blocked: (plan) => (ownKeys(plan).length < 3 ? 'Needs three keys.' : null),
    apply: (plan) => vault(plan, 2, 3, 'Vault'),
  },
  {
    id: 'wallets-three-of-five',
    step: 'wallets',
    label: 'A three of five vault',
    detail: 'Your first five keys, any three to spend.',
    blocked: (plan) => (ownKeys(plan).length < 5 ? 'Needs five keys.' : null),
    apply: (plan) => vault(plan, 3, 5, 'Vault'),
  },
  {
    id: 'wallets-single',
    step: 'wallets',
    label: 'A single-key wallet',
    detail: 'Your first key alone. Simple, and one loss from gone.',
    blocked: (plan) => (ownKeys(plan).length < 1 ? 'Needs a key.' : null),
    apply: (plan) => {
      const key = ownKeys(plan)[0]
      plan.wallets.push(
        createWallet({
          label: next(
            plan.wallets.map((entry) => entry.label),
            'Wallet'
          ),
          tier: 'active',
          stake: 'moderate',
          paths: [createSpendPath({ label: 'Single key', threshold: 1, keyIds: [key.id] })],
        })
      )
    },
  },

  // --- checks --------------------------------------------------------------
  {
    id: 'checks-standard',
    step: 'checks',
    label: 'The standard schedule',
    detail:
      'Restore every backup and spend from every wallet yearly, read every descriptor back, check every device, rehearse with every successor.',
    blocked: (plan) =>
      plan.keys.length + plan.wallets.length === 0 ? 'Nothing to check yet.' : null,
    apply: (plan) => {
      for (const key of plan.keys)
        if (key.backups.length > 0) addCheck(plan, 'backup-restore', { type: 'key', id: key.id })
      for (const wallet of plan.wallets) {
        addCheck(plan, 'spend-test', { type: 'wallet', id: wallet.id })
        if (wallet.configBackups.length > 0)
          addCheck(plan, 'config-backup-restore', { type: 'wallet', id: wallet.id })
      }
      for (const device of plan.devices)
        addCheck(plan, 'device-firmware', { type: 'device', id: device.id })
      for (const person of plan.people)
        if (person.role === 'successor')
          addCheck(plan, 'successor-dry-run', { type: 'person', id: person.id })
    },
  },
]

export function presetsFor(step: PresetStep): Preset[] {
  return PRESETS.filter((preset) => preset.step === step)
}
