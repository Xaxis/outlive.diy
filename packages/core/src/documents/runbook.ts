/**
 * The build runbook: ordered steps from nothing to the plan as designed.
 *
 * Two things make this different from a checklist. Steps are grouped into
 * phases that must happen in order, because distributing backups before
 * verifying them is how people end up with three copies of the same mistake.
 * And some steps are *gates*: they produce evidence rather than progress, and
 * nothing after them is safe until they pass. Gates are called out separately
 * because they are the steps everybody skips.
 */

import type { Id, Plan, Ref } from '../model/types.ts'
import { isMultisig, splitGroups, walletKeyIds } from '../model/selectors.ts'
import { indexPlan } from '../model/selectors.ts'

export type RunbookPhase =
  'prepare' | 'generate' | 'record' | 'distribute' | 'assemble' | 'verify' | 'brief' | 'schedule'

export const PHASE_ORDER: RunbookPhase[] = [
  'prepare',
  'generate',
  'record',
  'distribute',
  'assemble',
  'verify',
  'brief',
  'schedule',
]

export const PHASE_TITLE: Record<RunbookPhase, string> = {
  prepare: 'Prepare',
  generate: 'Generate keys',
  record: 'Record backups',
  distribute: 'Place them',
  assemble: 'Build the wallets',
  verify: 'Prove it works',
  brief: 'Tell the people who need to know',
  schedule: 'Set the maintenance',
}

export const PHASE_PURPOSE: Record<RunbookPhase, string> = {
  prepare: 'Get the objects together before anything secret exists.',
  generate: 'Create key material, on devices, offline.',
  record: 'Write it down on something that survives.',
  distribute: 'Put each copy where the plan says it goes.',
  assemble: 'Turn the keys into the wallets, and back up the configuration.',
  verify: 'Prove each claim the plan makes, before you rely on it.',
  brief: 'Give people the sentences they need, and none of the ones they do not.',
  schedule: 'Decide when each of these is checked again.',
}

export interface RunbookStep {
  id: string
  phase: RunbookPhase
  title: string
  detail: string
  /** Produces evidence rather than progress. Nothing downstream is safe until it passes. */
  gate: boolean
  subjects: Ref[]
}

export interface Runbook {
  steps: RunbookStep[]
  gates: RunbookStep[]
  /** Steps whose phase is complete only when every earlier phase is. */
  phases: { phase: RunbookPhase; steps: RunbookStep[] }[]
}

function step(
  id: string,
  phase: RunbookPhase,
  title: string,
  detail: string,
  options: { gate?: boolean; subjects?: Ref[] } = {}
): RunbookStep {
  return {
    id,
    phase,
    title,
    detail,
    gate: options.gate ?? false,
    subjects: options.subjects ?? [],
  }
}

export function buildRunbook(plan: Plan): Runbook {
  const index = indexPlan(plan)
  const steps: RunbookStep[] = []
  const place = (id: Id | null) =>
    id ? (index.locations.get(id)?.label ?? 'an unassigned place') : 'an unassigned place'

  // --- prepare --------------------------------------------------------------
  if (plan.devices.length > 0) {
    steps.push(
      step(
        'acquire',
        'prepare',
        `Acquire ${plan.devices.length} ${plan.devices.length === 1 ? 'signing device' : 'signing devices'}`,
        `${plan.devices
          .map((device) => `${device.label}${device.vendor ? ` (${device.vendor})` : ''}`)
          .join(
            ', '
          )}. Buy them at different times, from different routes, to an address that is not obviously yours. Do not use a device that arrived already initialised, and do not accept one whose packaging has been opened.`,
        { subjects: plan.devices.map((device) => ({ type: 'device', id: device.id })) }
      )
    )
    steps.push(
      step(
        'firmware',
        'prepare',
        'Verify firmware on every device before it holds anything',
        'Check the signature the vendor publishes, on a machine that is not the one you will use for anything else. A device compromised before the key exists compromises the key at the moment it is created, and nothing later fixes that.',
        { gate: true, subjects: plan.devices.map((device) => ({ type: 'device', id: device.id })) }
      )
    )
  }

  const media = new Set(plan.keys.flatMap((key) => key.backups.map((backup) => backup.medium)))
  if (media.size > 0) {
    const count = plan.keys.reduce((total, key) => total + key.backups.length, 0)
    steps.push(
      step(
        'backup-media',
        'prepare',
        'Get the backup media, one blank per backup in the plan',
        `The plan calls for ${count} ${count === 1 ? 'backup' : 'backups'} across ${[...media].join(', ')}. Have every blank in hand before you generate anything, so that no key exists for a week with nowhere to be written.`
      )
    )
  }

  // --- generate -------------------------------------------------------------
  for (const key of plan.keys) {
    if (key.heldBy !== null) {
      const holder = index.people.get(key.heldBy)
      steps.push(
        step(
          `generate-${key.id}`,
          'generate',
          `Have ${holder?.label ?? 'the holder'} generate ${key.label} themselves`,
          'A key somebody else holds is only independent if you never saw it. Ask them to generate it on their own device and send you nothing but its public information.',
          { subjects: [{ type: 'key', id: key.id }] }
        )
      )
      continue
    }
    const device = key.deviceId ? index.devices.get(key.deviceId) : null
    steps.push(
      step(
        `generate-${key.id}`,
        'generate',
        `Generate ${key.label}${device ? ` on ${device.label}` : ''}`,
        `Generate it on the device itself, offline, with nothing else connected. Never type it into a computer, never photograph it, and never let it exist anywhere but the device and the backup you are about to make.${
          key.passphrase.enabled
            ? ` This key uses a passphrase: decide it now, and treat it as a second secret with its own separate hiding place.`
            : ''
        }`,
        { subjects: [{ type: 'key', id: key.id }] }
      )
    )
  }

  // --- record ---------------------------------------------------------------
  for (const key of plan.keys) {
    for (const backup of key.backups) {
      const split = backup.split
      steps.push(
        step(
          `record-${backup.id}`,
          'record',
          `Record ${key.label} onto ${backup.label}${split ? ` (share of ${split.groupId})` : ''}`,
          `Medium: ${backup.medium.replace(/-/g, ' ')}.${
            split ? ` This is one share; ${split.threshold} shares reconstruct the key.` : ''
          } Write it by hand, from the device screen, and read it back off the medium a second time before the device is put away.`,
          {
            subjects: [
              { type: 'key', id: key.id },
              { type: 'backup', id: backup.id },
            ],
          }
        )
      )
    }
    if (key.passphrase.enabled && key.passphrase.storage !== 'memorized') {
      steps.push(
        step(
          `record-passphrase-${key.id}`,
          'record',
          `Record ${key.label}'s passphrase, apart from its seed`,
          `It goes to ${key.passphrase.locationIds.map(place).join(', ') || 'a location the plan has not named yet'}. If it ends up in the same container as the seed, it has stopped being a second factor.`,
          { subjects: [{ type: 'key', id: key.id }] }
        )
      )
    }
  }

  // --- distribute -----------------------------------------------------------
  const byLocation = new Map<string, string[]>()
  for (const key of plan.keys) {
    if (key.deviceId && key.deviceLocationId) {
      const label = index.devices.get(key.deviceId)?.label ?? key.label
      const existing = byLocation.get(key.deviceLocationId)
      if (existing) existing.push(label)
      else byLocation.set(key.deviceLocationId, [label])
    }
    for (const backup of key.backups) {
      if (!backup.locationId) continue
      const existing = byLocation.get(backup.locationId)
      const label = `${key.label} / ${backup.label}`
      if (existing) existing.push(label)
      else byLocation.set(backup.locationId, [label])
    }
  }
  for (const [locationId, items] of byLocation) {
    const location = index.locations.get(locationId)
    steps.push(
      step(
        `distribute-${locationId}`,
        'distribute',
        `Take ${items.length} ${items.length === 1 ? 'item' : 'items'} to ${location?.label ?? 'an unassigned place'}`,
        `${items.join(', ')}.${
          location?.tamperEvident
            ? ' Seal each one in a tamper-evident bag and photograph the seal number, not the contents.'
            : ' Consider a tamper-evident seal so that an opened container is visibly an opened container.'
        }${
          location?.requiresUserPresence
            ? ' This place needs you present, which is also true on the day you need it back.'
            : ''
        }`,
        { subjects: [{ type: 'location', id: locationId }] }
      )
    )
  }

  // --- assemble -------------------------------------------------------------
  for (const wallet of plan.wallets) {
    const keys = walletKeyIds(wallet)
      .map((keyId) => index.keys.get(keyId)?.label ?? keyId)
      .join(', ')
    steps.push(
      step(
        `assemble-${wallet.id}`,
        'assemble',
        `Build ${wallet.label}`,
        `${wallet.paths
          .map(
            (path) =>
              `${path.label}: ${path.threshold}-of-${path.keyIds.length}${
                path.timelockDays > 0 ? `, after ${path.timelockDays} days` : ''
              }`
          )
          .join(
            '. '
          )}. Using ${keys}. Confirm the wallet's first receive address on every device independently before sending anything to it.`,
        { subjects: [{ type: 'wallet', id: wallet.id }] }
      )
    )
    if (isMultisig(wallet)) {
      steps.push(
        step(
          `config-${wallet.id}`,
          'assemble',
          `Export ${wallet.label}'s configuration and copy it ${Math.max(2, wallet.configBackups.length)} times`,
          `The descriptor holds the participant public keys, the derivation paths and the policy. It contains no secret, so it can be stored more widely than a seed, and it must be: without it the seeds restore nothing.${
            wallet.configBackups.length
              ? ` Copies go to ${wallet.configBackups.map((backup) => place(backup.locationId)).join(', ')}.`
              : ' The plan does not yet say where the copies go.'
          }`,
          { subjects: [{ type: 'wallet', id: wallet.id }] }
        )
      )
    }
  }

  // --- verify ---------------------------------------------------------------
  for (const key of plan.keys) {
    if (key.backups.length === 0) continue
    const groups = [...splitGroups(key)]
    steps.push(
      step(
        `verify-${key.id}`,
        'verify',
        `Restore ${key.label} from its backup and confirm it matches`,
        `${
          groups.length
            ? `Reassemble ${groups[0][1].threshold} shares onto a spare device.`
            : 'Restore the written backup onto a spare device.'
        } Confirm the fingerprint or first address is the one the original produces, then wipe the spare. Until this passes, that backup is a piece of metal you have not read.`,
        { gate: true, subjects: [{ type: 'key', id: key.id }] }
      )
    )
  }
  for (const wallet of plan.wallets) {
    if (isMultisig(wallet)) {
      steps.push(
        step(
          `verify-config-${wallet.id}`,
          'verify',
          `Rebuild ${wallet.label} from the written configuration alone`,
          'On a clean machine, with only the paper copy and no exported file. Confirm the first address matches. A descriptor copied by hand has no checksum a human can see.',
          { gate: true, subjects: [{ type: 'wallet', id: wallet.id }] }
        )
      )
    }
    steps.push(
      step(
        `verify-spend-${wallet.id}`,
        'verify',
        `Send a small amount out of ${wallet.label}`,
        `Sign with the keys you would actually use in a recovery, not the two that happen to be nearest. ${
          wallet.paths.some((path) => path.timelockDays > 0)
            ? 'Test the timelocked path separately, on a testnet or with an amount you can leave locked.'
            : ''
        }`,
        { gate: true, subjects: [{ type: 'wallet', id: wallet.id }] }
      )
    )
  }

  // --- brief ----------------------------------------------------------------
  for (const person of plan.people) {
    if (person.role === 'aware') continue
    steps.push(
      step(
        `brief-${person.id}`,
        'brief',
        `Brief ${person.label}`,
        person.role === 'cosigner' || person.role === 'key-agent'
          ? 'Confirm what they hold, how you would reach them, and what they should do if somebody claiming to be you asks them to sign in a hurry.'
          : 'Give them the successor letter. It names no secret and no place; it says that a plan exists, where the instructions are, and what never to type into a computer.',
        { subjects: [{ type: 'person', id: person.id }] }
      )
    )
  }
  if (plan.people.some((person) => person.role === 'successor' || person.role === 'executor')) {
    steps.push(
      step(
        'dry-run',
        'brief',
        'Watch a successor attempt the recovery, without helping',
        'On a throwaway wallet, with the written instructions and nothing else. Whatever they get stuck on is a defect in the instructions, not in them. Rewrite it and repeat.',
        { gate: true }
      )
    )
  }

  // --- schedule -------------------------------------------------------------
  steps.push(
    step(
      'schedule',
      'schedule',
      'Put every check on a date',
      plan.verifications.length
        ? `The plan defines ${plan.verifications.length} ${plan.verifications.length === 1 ? 'check' : 'checks'}. Put them in a calendar that outlives this device.`
        : 'The plan defines no checks yet. Add at least a yearly backup restore and a spend test, and record the date each is done.'
    )
  )
  steps.push(
    step(
      'record-nothing',
      'schedule',
      'Destroy the working notes',
      'Anything written during this build that was not meant to survive it: draft word lists, photographs, the paper you checked a fingerprint on. Burn or shred them. This is the step that most often leaves a copy behind.'
    )
  )

  const ordered = PHASE_ORDER.flatMap((phase) => steps.filter((entry) => entry.phase === phase))
  return {
    steps: ordered,
    gates: ordered.filter((entry) => entry.gate),
    phases: PHASE_ORDER.map((phase) => ({
      phase,
      steps: ordered.filter((entry) => entry.phase === phase),
    })).filter((group) => group.steps.length > 0),
  }
}
