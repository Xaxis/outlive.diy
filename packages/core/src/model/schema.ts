/**
 * Runtime validation for plan files.
 *
 * A plan arrives from a file the user picked off a disk, so it is untrusted
 * input in the ordinary sense: it may be truncated, hand-edited, written by an
 * older version, or not a plan at all. Everything that enters the engine goes
 * through here first, and the failure path has to be legible, because the
 * person reading the error is the person who owns the file.
 */

import { z } from 'zod'
import type { Plan, PlanFile } from './types.ts'
import { SCHEMA_VERSION } from './types.ts'

/**
 * How strict to be.
 *
 * A plan is a file the user owns, which means it will be hand-edited, kept for
 * years, and opened by a build that is not the one that wrote it. Refusing it
 * over a boolean somebody deleted would be pedantry dressed as safety.
 *
 * So: anything that can be defaulted safely is defaulted, and the defaults are
 * the cautious ones. Anything that cannot be guessed, which is identity and
 * structure, is still required, because guessing those would produce a plan the
 * user did not write and would then be shown an analysis of.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a calendar date in YYYY-MM-DD form')

const id = z.string().min(1).max(64)
const label = z.string().max(120)
const notes = z.string().max(2000)
const days = z.number().int().min(0).max(36500)

const accessSchema = z.object({
  personId: id,
  condition: z.enum(['always', 'with-user', 'after-death']),
  delayDays: days,
})

export const locationSchema = z.object({
  id,
  label,
  kind: z.enum([
    'home',
    'second-home',
    'workplace',
    'bank-vault',
    'private-vault',
    'trusted-person',
    'concealed',
    'on-person',
    'other',
  ]),
  travelMinutes: z.number().int().min(0).max(100000).nullable().default(null),
  disasterGroup: z.string().max(60).nullable().default(null),
  access: z.array(accessSchema).default([]),
  custodianId: id.nullable().default(null),
  requiresUserPresence: z.boolean().default(false),
  tamperEvident: z.boolean().default(false),
  notes: notes.default(''),
})

export const deviceSchema = z.object({
  id,
  label,
  kind: z.enum([
    'hardware-signer',
    'air-gapped-signer',
    'mobile-wallet',
    'desktop-wallet',
    'paper-only',
    'service-cosigner',
    'other',
  ]),
  vendor: z.string().max(60).nullable().default(null),
  model: z.string().max(60).nullable().default(null),
  architecture: z.string().max(60).nullable().default(null),
  airGapped: z.boolean().default(false),
  pin: z
    .object({
      storage: z.enum(['memorized', 'written', 'none']).default('memorized'),
      locationId: id.nullable().default(null),
      knownBy: z.array(id).default([]),
    })
    .default({ storage: 'memorized', locationId: null, knownBy: [] }),
  storesWalletConfig: z.boolean().default(false),
  supplyChain: z
    .enum(['direct-from-vendor', 'reseller', 'second-hand', 'unknown'])
    .default('unknown'),
  notes: notes.default(''),
})

const backupMedium = z.enum(['steel', 'paper', 'encrypted-digital', 'plain-digital', 'memorized'])

export const backupSchema = z.object({
  id,
  label,
  medium: backupMedium,
  locationId: id.nullable().default(null),
  split: z
    .object({ groupId: z.string().min(1).max(64), threshold: z.number().int().min(1).max(32) })
    .nullable()
    .default(null),
  tamperEvident: z.boolean(),
  notes: notes.default(''),
})

export const keySchema = z.object({
  id,
  label,
  heldBy: id.nullable().default(null),
  deviceId: id.nullable().default(null),
  deviceLocationId: id.nullable().default(null),
  backups: z.array(backupSchema).default([]),
  passphrase: z
    .object({
      enabled: z.boolean().default(false),
      storage: z.enum(['memorized', 'written', 'split']).default('memorized'),
      locationIds: z.array(id).default([]),
      splitThreshold: z.number().int().min(1).max(32).nullable().default(null),
      knownBy: z.array(id).default([]),
    })
    .default({
      enabled: false,
      storage: 'memorized',
      locationIds: [],
      splitThreshold: null,
      knownBy: [],
    }),
  notes: notes.default(''),
})

export const spendPathSchema = z.object({
  id,
  label,
  kind: z.enum(['primary', 'recovery', 'inheritance']),
  threshold: z.number().int().min(1).max(32),
  keyIds: z.array(id).default([]),
  timelockDays: days.default(0),
})

export const walletSchema = z.object({
  id,
  label,
  tier: z.enum(['hot', 'active', 'vault']),
  stake: z.enum(['small', 'moderate', 'large']),
  paths: z.array(spendPathSchema).default([]),
  configBackups: z
    .array(
      z.object({
        id,
        label,
        locationId: id.nullable().default(null),
        medium: backupMedium.default('paper'),
        notes: notes.default(''),
      })
    )
    .default([]),
  decoy: z.boolean().default(false),
  notes: notes.default(''),
})

export const personSchema = z.object({
  id,
  label,
  role: z.enum(['cosigner', 'successor', 'executor', 'key-agent', 'aware', 'professional']),
  technicalSkill: z.enum(['none', 'basic', 'competent', 'expert']).default('none'),
  knowsPlanExists: z.boolean().default(false),
  knowsWhereInstructionsAre: z.boolean().default(false),
  availability: z.enum(['immediate', 'days', 'weeks', 'unknown']).default('unknown'),
  notes: notes.default(''),
})

export const verificationSchema = z.object({
  id,
  kind: z.enum([
    'backup-restore',
    'config-backup-restore',
    'spend-test',
    'recovery-drill',
    'successor-dry-run',
    'location-access',
    'device-firmware',
    'passphrase-recall',
    'inventory-check',
  ]),
  subject: z.object({
    type: z.enum([
      'plan',
      'key',
      'device',
      'location',
      'wallet',
      'person',
      'backup',
      'verification',
      'path',
    ]),
    id,
  }),
  lastVerifiedAt: isoDate.nullable().default(null),
  intervalDays: days.default(365),
  notes: notes.default(''),
})

export const profileSchema = z.object({
  concerns: z
    .array(
      z.enum([
        'loss',
        'theft',
        'coercion',
        'fire-flood',
        'death',
        'incapacity',
        'legal-seizure',
        'insider',
        'supply-chain',
      ])
    )
    .default(['loss', 'theft', 'fire-flood', 'death']),
  recoveryToleranceDays: days.default(30),
  horizonYears: z.number().int().min(0).max(200).default(30),
  jurisdictionCount: z.number().int().min(1).max(50).default(1),
  travelsFrequently: z.boolean().default(false),
})

export const planSchema = z.object({
  schemaVersion: z.number().int().min(1),
  id,
  name: label,
  kind: z.enum(['current', 'draft']),
  createdAt: isoDate,
  updatedAt: isoDate,
  profile: profileSchema.default({
    concerns: ['loss', 'theft', 'fire-flood', 'death'],
    recoveryToleranceDays: 30,
    horizonYears: 30,
    jurisdictionCount: 1,
    travelsFrequently: false,
  }),
  locations: z.array(locationSchema).default([]),
  people: z.array(personSchema).default([]),
  devices: z.array(deviceSchema).default([]),
  keys: z.array(keySchema).default([]),
  wallets: z.array(walletSchema).default([]),
  verifications: z.array(verificationSchema).default([]),
  progress: z.record(z.string().max(120), isoDate).default({}),
})

export const planFileSchema = z.object({
  schemaVersion: z.number().int().min(1),
  generator: z.string().max(200).default('unknown'),
  savedAt: isoDate.default('1970-01-01'),
  plans: z.array(planSchema).min(1),
  activePlanId: id.nullable().default(null),
})

// Compile-time proof that the runtime schema and the hand-written types in
// `types.ts` still describe the same object. If one drifts, this stops
// building, which is the only reliable way to keep a validator honest.
const _schemaMatchesType: (value: z.infer<typeof planSchema>) => Plan = (value) => value
const _typeMatchesSchema: (value: Plan) => z.infer<typeof planSchema> = (value) => value
const _fileMatchesType: (value: z.infer<typeof planFileSchema>) => PlanFile = (value) => value
const _typeMatchesFile: (value: PlanFile) => z.infer<typeof planFileSchema> = (value) => value
void _schemaMatchesType
void _typeMatchesSchema
void _fileMatchesType
void _typeMatchesFile

export interface ParseFailure {
  ok: false
  /** One line per problem, already phrased for a human. */
  problems: string[]
}

export type ParseResult<T> = { ok: true; value: T } | ParseFailure

function describe(error: z.ZodError): string[] {
  return error.issues.slice(0, 40).map((issue) => {
    const where = issue.path.length ? issue.path.join('.') : 'the file'
    return `${where}: ${issue.message}`
  })
}

/**
 * Parse a plan file. Unknown future versions are refused rather than guessed
 * at: a plan half-understood is worse than one that will not open, because the
 * user would act on it.
 */
export function parsePlanFile(input: unknown): ParseResult<PlanFile> {
  const parsed = planFileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, problems: describe(parsed.error) }
  if (parsed.data.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      problems: [
        `This file was written by a newer version of outlive.diy (format ${parsed.data.schemaVersion}, this build understands ${SCHEMA_VERSION}). Open it with the newer version rather than risking a partial read.`,
      ],
    }
  }
  return { ok: true, value: parsed.data }
}

/**
 * Structural problems that make a plan self-inconsistent rather than merely
 * unwise: references that point at nothing. Kept apart from the analysis
 * because a dangling reference is a bug in the file, not a finding about the
 * custody design.
 */
export function referentialProblems(plan: Plan): string[] {
  const problems: string[] = []
  const locationIds = new Set(plan.locations.map((l) => l.id))
  const personIds = new Set(plan.people.map((p) => p.id))
  const deviceIds = new Set(plan.devices.map((d) => d.id))
  const keyIds = new Set(plan.keys.map((k) => k.id))

  const check = (value: string | null, pool: Set<string>, what: string) => {
    if (value !== null && !pool.has(value)) problems.push(what)
  }

  for (const location of plan.locations) {
    check(location.custodianId, personIds, `${location.label}: controlled by an unknown person`)
    for (const access of location.access) {
      check(access.personId, personIds, `${location.label}: access by an unknown person`)
    }
  }
  for (const device of plan.devices) {
    check(device.pin.locationId, locationIds, `${device.label}: PIN kept at an unknown location`)
    for (const person of device.pin.knownBy) {
      check(person, personIds, `${device.label}: PIN known by an unknown person`)
    }
  }
  for (const key of plan.keys) {
    check(key.heldBy, personIds, `${key.label}: held by an unknown person`)
    check(key.deviceId, deviceIds, `${key.label}: uses an unknown device`)
    check(key.deviceLocationId, locationIds, `${key.label}: device at an unknown location`)
    for (const backup of key.backups) {
      check(backup.locationId, locationIds, `${key.label} / ${backup.label}: unknown location`)
    }
    for (const location of key.passphrase.locationIds) {
      check(location, locationIds, `${key.label}: passphrase at an unknown location`)
    }
    for (const person of key.passphrase.knownBy) {
      check(person, personIds, `${key.label}: passphrase known by an unknown person`)
    }
  }
  for (const wallet of plan.wallets) {
    for (const path of wallet.paths) {
      for (const key of path.keyIds) {
        check(key, keyIds, `${wallet.label} / ${path.label}: unknown key`)
      }
    }
    for (const backup of wallet.configBackups) {
      check(backup.locationId, locationIds, `${wallet.label} / ${backup.label}: unknown location`)
    }
  }
  return problems
}
