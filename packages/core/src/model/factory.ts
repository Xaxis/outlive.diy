/**
 * Constructors and defaults.
 *
 * Defaults are opinionated in one direction only: they assume less than the
 * user probably has. A new device is not air-gapped, does not store the wallet
 * configuration, and came from somewhere unknown. Every one of those defaults
 * produces a finding, and the user clears it by saying what is actually true.
 * Defaulting the other way would produce a clean report for a plan nobody has
 * described yet, which is the failure mode this whole tool exists to avoid.
 */

import type {
  Backup,
  Device,
  Id,
  IsoDate,
  Key,
  Location,
  Person,
  Plan,
  Profile,
  SpendPath,
  Verification,
  Wallet,
  WalletConfigBackup,
} from './types.ts'
import { SCHEMA_VERSION } from './types.ts'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Short, collision-resistant enough for a document holding tens of objects. */
export function newId(prefix: string): Id {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  let suffix = ''
  for (const byte of bytes) suffix += ALPHABET[byte % ALPHABET.length]
  return `${prefix}_${suffix}`
}

export function today(now: Date = new Date()): IsoDate {
  return now.toISOString().slice(0, 10)
}

/** "Key A", "Key B", ... "Key AA". Role labels, never names. */
export function letterLabel(stem: string, taken: readonly string[]): string {
  for (let index = 0; index < 702; index += 1) {
    const label = `${stem} ${letters(index)}`
    if (!taken.includes(label)) return label
  }
  return `${stem} ${taken.length + 1}`
}

function letters(index: number): string {
  const first = String.fromCharCode(65 + (index % 26))
  return index < 26 ? first : String.fromCharCode(64 + Math.floor(index / 26)) + first
}

/** "Successor 1", "Successor 2", ... */
export function numberLabel(stem: string, taken: readonly string[]): string {
  for (let index = 1; index < 1000; index += 1) {
    const label = `${stem} ${index}`
    if (!taken.includes(label)) return label
  }
  return `${stem} ${taken.length + 1}`
}

export const defaultProfile: Profile = {
  concerns: ['loss', 'theft', 'fire-flood', 'death'],
  recoveryToleranceDays: 30,
  horizonYears: 30,
  jurisdictionCount: 1,
  travelsFrequently: false,
}

export function createLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: newId('loc'),
    label: 'Site A',
    kind: 'home',
    travelMinutes: 0,
    disasterGroup: null,
    access: [],
    custodianId: null,
    requiresUserPresence: false,
    tamperEvident: false,
    notes: '',
    ...overrides,
  }
}

export function createPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: newId('per'),
    label: 'Successor 1',
    role: 'successor',
    technicalSkill: 'none',
    knowsPlanExists: false,
    knowsWhereInstructionsAre: false,
    availability: 'unknown',
    notes: '',
    ...overrides,
  }
}

export function createDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: newId('dev'),
    label: 'Signer A',
    kind: 'hardware-signer',
    vendor: null,
    model: null,
    architecture: null,
    airGapped: false,
    pin: { storage: 'memorized', locationId: null, knownBy: [] },
    storesWalletConfig: false,
    supplyChain: 'unknown',
    notes: '',
    ...overrides,
  }
}

export function createBackup(overrides: Partial<Backup> = {}): Backup {
  return {
    id: newId('bak'),
    label: 'Backup',
    medium: 'steel',
    locationId: null,
    split: null,
    tamperEvident: false,
    notes: '',
    ...overrides,
  }
}

export function createKey(overrides: Partial<Key> = {}): Key {
  return {
    id: newId('key'),
    label: 'Key A',
    heldBy: null,
    deviceId: null,
    deviceLocationId: null,
    backups: [],
    passphrase: {
      enabled: false,
      storage: 'memorized',
      locationIds: [],
      splitThreshold: null,
      knownBy: [],
    },
    notes: '',
    ...overrides,
  }
}

export function createSpendPath(overrides: Partial<SpendPath> = {}): SpendPath {
  return {
    id: newId('path'),
    label: 'Everyday',
    kind: 'primary',
    threshold: 2,
    keyIds: [],
    timelockDays: 0,
    ...overrides,
  }
}

export function createConfigBackup(
  overrides: Partial<WalletConfigBackup> = {}
): WalletConfigBackup {
  return {
    id: newId('cfg'),
    label: 'Wallet configuration',
    locationId: null,
    medium: 'paper',
    notes: '',
    ...overrides,
  }
}

export function createWallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    id: newId('wal'),
    label: 'Vault',
    tier: 'vault',
    stake: 'large',
    paths: [],
    configBackups: [],
    decoy: false,
    notes: '',
    ...overrides,
  }
}

/** Default cadences. Slow enough to keep, often enough to matter. */
export const DEFAULT_INTERVAL_DAYS: Record<Verification['kind'], number> = {
  'backup-restore': 365,
  'config-backup-restore': 365,
  'spend-test': 180,
  'recovery-drill': 365,
  'successor-dry-run': 730,
  'location-access': 180,
  'device-firmware': 365,
  'passphrase-recall': 90,
  'inventory-check': 180,
}

export function createVerification(overrides: Partial<Verification> = {}): Verification {
  const kind = overrides.kind ?? 'backup-restore'
  return {
    id: newId('ver'),
    kind,
    subject: { type: 'plan', id: 'plan' },
    lastVerifiedAt: null,
    intervalDays: DEFAULT_INTERVAL_DAYS[kind],
    notes: '',
    ...overrides,
  }
}

export function createPlan(overrides: Partial<Plan> = {}): Plan {
  const date = today()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId('plan'),
    name: 'Untitled plan',
    kind: 'current',
    createdAt: date,
    updatedAt: date,
    profile: { ...defaultProfile },
    locations: [],
    people: [],
    devices: [],
    keys: [],
    wallets: [],
    verifications: [],
    ...overrides,
  }
}
