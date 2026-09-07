/**
 * The custody model.
 *
 * Everything here describes the *shape* of a setup: how many keys exist, what
 * threshold spends them, which physical objects sit in which places, and who
 * can reach those places. Nothing here can hold a secret, and that is a design
 * constraint rather than a convention. There is no field for a seed word, an
 * extended public key, a descriptor, an address, or an amount, so there is
 * nowhere for one to be put.
 *
 * Locations and people are roles, never names. "Site B" and "Successor 1" are
 * what the model knows about them.
 */

export type Id = string

/** ISO 8601 calendar date, `YYYY-MM-DD`. Dates only: this model has no clock. */
export type IsoDate = string

export type EntityType =
  'plan' | 'key' | 'device' | 'location' | 'wallet' | 'person' | 'backup' | 'verification' | 'path'

/** A pointer to something in the plan, used by findings and by verifications. */
export interface Ref {
  type: EntityType
  id: Id
}

// --- Locations --------------------------------------------------------------

export type LocationKind =
  | 'home'
  | 'second-home'
  | 'workplace'
  | 'bank-vault'
  | 'private-vault'
  | 'trusted-person'
  | 'concealed'
  | 'on-person'
  | 'other'

/**
 * When somebody other than the user can get into a place.
 *
 * The distinction carries most of the weight in both directions. A person with
 * `always` access is an attack surface today. A person with `after-death`
 * access is an inheritance route and no more: they cannot help with a recovery
 * the user is alive for, and their access arrives only after whatever legal
 * delay `delayDays` records.
 */
export type AccessCondition = 'always' | 'with-user' | 'after-death'

export interface LocationAccess {
  personId: Id
  condition: AccessCondition
  /** Legal or procedural delay before the access becomes real. Probate, mostly. */
  delayDays: number
}

export interface Location {
  id: Id
  /** A role label. "Site B", not a street. */
  label: string
  kind: LocationKind
  /** Door-to-door, one way, from where the user usually is. Null if unknown. */
  travelMinutes: number | null
  /**
   * Locations sharing a group fail together: one building, one flood plain, one
   * seismic zone, one legal jurisdiction seizing at once. Free text, because
   * the user knows their own geography and a fixed list would be wrong.
   */
  disasterGroup: string | null
  access: LocationAccess[]
  /**
   * Somebody other than the user who controls the door: a relative whose house
   * it is, a lawyer whose safe it is. If they become unavailable, so does the
   * place, however much the user is entitled to what is inside.
   */
  custodianId: Id | null
  /** The user must be physically present for anything to come out. Bank boxes. */
  requiresUserPresence: boolean
  /** Opening it leaves evidence: tamper bags, seals, a witnessed log. */
  tamperEvident: boolean
  notes: string
}

// --- Devices ----------------------------------------------------------------

export type DeviceKind =
  | 'hardware-signer'
  | 'air-gapped-signer'
  | 'mobile-wallet'
  | 'desktop-wallet'
  | 'paper-only'
  | 'service-cosigner'
  | 'other'

export type SupplyChain = 'direct-from-vendor' | 'reseller' | 'second-hand' | 'unknown'

/** Where a device's unlock secret lives. A PIN is a secret about a secret. */
export interface PinRecord {
  storage: 'memorized' | 'written' | 'none'
  /** Where it is written down, when it is. */
  locationId: Id | null
  /** People who know it, by role. */
  knownBy: Id[]
}

export interface Device {
  id: Id
  label: string
  kind: DeviceKind
  /**
   * Vendor identity matters structurally even when the model is unknown: two
   * keys behind one vendor are one failure, not two. Free text so that the
   * engine never depends on a vendor table it cannot keep current.
   */
  vendor: string | null
  model: string | null
  /**
   * Shared silicon or a shared firmware lineage is correlated failure the same
   * way a shared vendor is, and it crosses brand boundaries.
   */
  architecture: string | null
  airGapped: boolean
  pin: PinRecord
  /**
   * Whether the device itself retains the multisig wallet configuration. Most
   * do not. Defaults to false because assuming otherwise is how people discover
   * at recovery time that m seeds are not enough.
   */
  storesWalletConfig: boolean
  supplyChain: SupplyChain
  notes: string
}

// --- Backups ----------------------------------------------------------------

export type BackupMedium = 'steel' | 'paper' | 'encrypted-digital' | 'plain-digital' | 'memorized'

/**
 * One physical backup object in one place.
 *
 * A Shamir/SLIP-39 share is modelled as an ordinary backup that carries a
 * `split` group: several backups sharing a `groupId` reconstruct one secret
 * once `threshold` of them are in hand. That keeps a share and a whole backup
 * the same kind of thing, because physically they are.
 */
export interface Backup {
  id: Id
  label: string
  medium: BackupMedium
  /** Null only for `memorized`, which lives in a head rather than a place. */
  locationId: Id | null
  split: { groupId: string; threshold: number } | null
  tamperEvident: boolean
  notes: string
}

// --- Passphrase -------------------------------------------------------------

export type PassphraseStorage = 'memorized' | 'written' | 'split'

/**
 * A BIP-39 passphrase is a second secret with its own independent failure
 * modes, and treating it as part of the seed is the mistake it exists to
 * punish. Memorised, it dies with the user. Written beside the seed, it is
 * decoration.
 */
export interface Passphrase {
  enabled: boolean
  storage: PassphraseStorage
  /** Where it is written, or where its shares are. Empty when memorised. */
  locationIds: Id[]
  /** Shares required when `storage` is `split`. */
  splitThreshold: number | null
  knownBy: Id[]
}

// --- Keys -------------------------------------------------------------------

export interface Key {
  id: Id
  /** A role label. "Key A". */
  label: string
  /** `self`, or a person who holds it on the user's behalf. */
  heldBy: Id | null
  deviceId: Id | null
  /** Where the device lives. Independent of where any backup lives. */
  deviceLocationId: Id | null
  backups: Backup[]
  passphrase: Passphrase
  notes: string
}

// --- Wallets ----------------------------------------------------------------

export type WalletTier = 'hot' | 'active' | 'vault'
export type Stake = 'small' | 'moderate' | 'large'
export type SpendPathKind = 'primary' | 'recovery' | 'inheritance'

/**
 * One way to spend. A plain m-of-n wallet has exactly one. A timelocked
 * inheritance policy has two: the everyday one, and a path that only opens
 * after the coins have sat untouched for `timelockDays`.
 */
export interface SpendPath {
  id: Id
  label: string
  kind: SpendPathKind
  /** m */
  threshold: number
  /** The n. Order is presentation only. */
  keyIds: Id[]
  /** Days of inactivity before the path opens. 0 for an everyday path. */
  timelockDays: number
}

/**
 * The wallet configuration: the descriptor, the participant xpubs, the
 * derivation, the policy. Not held here, only located.
 *
 * This is the most commonly missing object in a real multisig setup and the
 * one whose absence is unrecoverable. m seeds and no descriptor is m seeds and
 * no wallet.
 */
export interface WalletConfigBackup {
  id: Id
  label: string
  locationId: Id | null
  medium: BackupMedium
  notes: string
}

export interface Wallet {
  id: Id
  label: string
  tier: WalletTier
  /** Proportion of the whole, never an amount. */
  stake: Stake
  paths: SpendPath[]
  configBackups: WalletConfigBackup[]
  /**
   * A wallet that exists to be surrendered. It holds a real, small balance so
   * that handing it over under compulsion is credible, and its whole job is to
   * end the conversation.
   */
  decoy: boolean
  notes: string
}

// --- People -----------------------------------------------------------------

export type PersonRole =
  'cosigner' | 'successor' | 'executor' | 'key-agent' | 'aware' | 'professional'
export type TechnicalSkill = 'none' | 'basic' | 'competent' | 'expert'
export type Availability = 'immediate' | 'days' | 'weeks' | 'unknown'

export interface Person {
  id: Id
  /** A role label. "Successor 1". */
  label: string
  role: PersonRole
  /** What the runbook has to spell out, and how far it has to go back. */
  technicalSkill: TechnicalSkill
  knowsPlanExists: boolean
  knowsWhereInstructionsAre: boolean
  availability: Availability
  notes: string
}

// --- Verification -----------------------------------------------------------

export type VerificationKind =
  | 'backup-restore'
  | 'config-backup-restore'
  | 'spend-test'
  | 'recovery-drill'
  | 'successor-dry-run'
  | 'location-access'
  | 'device-firmware'
  | 'passphrase-recall'
  | 'inventory-check'

/**
 * A claim about the plan that has been checked rather than assumed. The date is
 * the whole point: an untested backup is a belief, and this is where the model
 * records the difference.
 */
export interface Verification {
  id: Id
  kind: VerificationKind
  subject: Ref
  /** Null means never done. */
  lastVerifiedAt: IsoDate | null
  intervalDays: number
  notes: string
}

// --- Profile ----------------------------------------------------------------

export type Concern =
  | 'loss'
  | 'theft'
  | 'coercion'
  | 'fire-flood'
  | 'death'
  | 'incapacity'
  | 'legal-seizure'
  | 'insider'
  | 'supply-chain'

/**
 * What the user is actually planning against, and how much disruption they can
 * absorb. This never suppresses a finding. It changes the order they are read
 * in, because a list that treats every risk as equally urgent is a list nobody
 * finishes.
 */
export interface Profile {
  concerns: Concern[]
  /** How long the user can tolerate being unable to spend after an incident. */
  recoveryToleranceDays: number
  /** How long the plan has to keep working without maintenance. */
  horizonYears: number
  /** Legal jurisdictions the plan spans. One is a correlation the user may not see. */
  jurisdictionCount: number
  travelsFrequently: boolean
}

// --- Plan -------------------------------------------------------------------

export const SCHEMA_VERSION = 1

export type PlanKind = 'current' | 'draft'

export interface Plan {
  schemaVersion: number
  id: Id
  name: string
  /** `current` is what exists. `draft` is a candidate to compare against it. */
  kind: PlanKind
  createdAt: IsoDate
  updatedAt: IsoDate
  profile: Profile
  locations: Location[]
  people: Person[]
  devices: Device[]
  keys: Key[]
  wallets: Wallet[]
  verifications: Verification[]
  /**
   * Build runbook steps that have been done, by step id, with the date.
   *
   * Kept in the plan rather than in the browser because the runbook is a
   * multi-week job with travel in it, and progress through it is part of what
   * the plan *is*: half-built is a state worth being able to hand to somebody
   * else, or to open on another machine.
   */
  progress: Record<string, IsoDate>
}

/** A saved file holds the plan the user runs and any candidates beside it. */
export interface PlanFile {
  schemaVersion: number
  /** Written by the app that saved it, for diagnosing a file that will not load. */
  generator: string
  savedAt: IsoDate
  plans: Plan[]
  activePlanId: Id | null
}
