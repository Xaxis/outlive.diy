/**
 * Staleness: what is believed rather than tested.
 *
 * Everything else in this engine reasons about a description. This analysis is
 * the only one that asks whether the description was ever checked against the
 * world, which makes it the one that decides whether the rest is worth
 * anything.
 */

import type { Finding } from './findings.ts'
import { makeFinding } from './findings.ts'
import type { AnalysisContext } from './context.ts'
import { daysBetween, isMultisig } from '../model/selectors.ts'
import type { Ref, Verification } from '../model/types.ts'
import { heirs } from './succession.ts'

function names(items: readonly string[]): string {
  if (items.length === 0) return 'nothing'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export interface Overdue {
  verification: Verification
  /** Days past due. Zero or less means current. */
  overdueDays: number
  /** Null when it has never been done. */
  lastVerifiedAt: string | null
}

export function overdueVerifications(ctx: AnalysisContext): Overdue[] {
  return ctx.plan.verifications
    .map((verification) => {
      if (verification.lastVerifiedAt === null) {
        return { verification, overdueDays: Number.POSITIVE_INFINITY, lastVerifiedAt: null }
      }
      const age = daysBetween(verification.lastVerifiedAt, ctx.today)
      return {
        verification,
        overdueDays: age - verification.intervalDays,
        lastVerifiedAt: verification.lastVerifiedAt,
      }
    })
    .filter((entry) => entry.overdueDays > 0)
}

/** Whether a claim of this kind has ever been recorded as done. */
function everDone(ctx: AnalysisContext, kind: Verification['kind'], subject?: Ref): boolean {
  return ctx.plan.verifications.some(
    (verification) =>
      verification.kind === kind &&
      verification.lastVerifiedAt !== null &&
      (subject === undefined ||
        (verification.subject.type === subject.type && verification.subject.id === subject.id))
  )
}

export function analyseStaleness(ctx: AnalysisContext): Finding[] {
  const { plan } = ctx
  const findings: Finding[] = []

  const anythingVerified = plan.verifications.some(
    (verification) => verification.lastVerifiedAt !== null
  )
  const hasSubstance = plan.keys.length > 0 || plan.wallets.length > 0

  if (hasSubstance && !anythingVerified) {
    findings.push(
      makeFinding(plan, {
        rule: 'T006',
        key: 'plan',
        title: 'Nothing in this plan has been verified',
        detail:
          'No backup has been restored, no spend has been tested, no location has been opened to check what is in it. Everything above describes what you believe is true, and none of it has been checked against the world.',
        remediation:
          'Restore one backup and confirm it produces the wallet you expect. That single test converts the largest assumption in the plan into a fact.',
        subjects: [{ type: 'plan', id: plan.id }],
      })
    )
    // The specific "never done" rules below would repeat this for every object.
    // One statement of the same fact is enough.
  }

  for (const entry of overdueVerifications(ctx)) {
    if (entry.lastVerifiedAt === null) continue
    const { verification } = entry
    findings.push(
      makeFinding(plan, {
        rule: 'T001',
        key: verification.id,
        title: `${describeKind(verification.kind)} is ${entry.overdueDays} days overdue`,
        detail: `Last done on ${entry.lastVerifiedAt}, on a ${verification.intervalDays}-day cycle. What it stood for has quietly gone back to being an assumption.`,
        remediation: `Do it again, then record the date. If the interval is unrealistic, change the interval rather than living with it overdue.`,
        subjects: [verification.subject],
      })
    )
  }

  if (anythingVerified) {
    const unrestored = plan.keys.filter(
      (key) =>
        key.backups.length > 0 &&
        !everDone(ctx, 'backup-restore', { type: 'key', id: key.id }) &&
        !key.backups.some((backup) =>
          everDone(ctx, 'backup-restore', { type: 'backup', id: backup.id })
        )
    )
    if (unrestored.length > 0) {
      findings.push(
        makeFinding(plan, {
          rule: 'T002',
          key: 'backups',
          title: `${names(unrestored.map((key) => key.label))} ${unrestored.length === 1 ? 'has' : 'have'} never been restored from backup`,
          detail:
            'A backup that has never been read is a belief about a piece of metal. Transcription errors, a wrong word order, a missing passphrase and an unreadable stamping all look identical until the day it is needed.',
          remediation:
            'Restore each backup onto a spare device and check that the wallet it produces is the one you expect. Wipe the device afterwards.',
          subjects: unrestored.map((key) => ({ type: 'key' as const, id: key.id })),
        })
      )
    }

    const untested = plan.wallets.filter(
      (wallet) => !everDone(ctx, 'spend-test', { type: 'wallet', id: wallet.id })
    )
    if (untested.length > 0) {
      findings.push(
        makeFinding(plan, {
          rule: 'T003',
          key: 'spend',
          title: `${names(untested.map((wallet) => wallet.label))} ${untested.length === 1 ? 'has' : 'have'} never been spend-tested`,
          detail:
            'The first real spend should not be the one that matters. Fee handling, device firmware, co-signing across machines and the wallet configuration itself all fail in ways that only appear at signing time.',
          remediation:
            'Send a small amount out of each wallet using the keys you expect to use in a recovery, not the convenient ones.',
          subjects: untested.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        })
      )
    }

    for (const wallet of plan.wallets) {
      if (!isMultisig(wallet) || wallet.configBackups.length === 0) continue
      if (everDone(ctx, 'config-backup-restore', { type: 'wallet', id: wallet.id })) continue
      findings.push(
        makeFinding(plan, {
          rule: 'T002',
          key: `config:${wallet.id}`,
          title: `${wallet.label}'s configuration backup has never been read back`,
          detail:
            'A descriptor copied by hand is a long string with no checksum a human can see. It is worth exactly as much as the one test nobody has run.',
          remediation: `Rebuild ${wallet.label} on a clean machine from the written configuration alone, and confirm the first address matches.`,
          subjects: [{ type: 'wallet', id: wallet.id }],
        })
      )
    }

    if (heirs(plan).length > 0 && !everDone(ctx, 'successor-dry-run')) {
      findings.push(
        makeFinding(plan, {
          rule: 'T004',
          key: 'dry-run',
          title: 'The succession route has never been rehearsed',
          detail:
            'Every step you have not watched somebody else attempt is a step you are guessing about. The instructions read clearly to their author and to nobody else.',
          remediation:
            'Have a successor walk the recovery on a throwaway wallet, with you watching and not helping. Rewrite whatever they get stuck on.',
          subjects: [{ type: 'plan', id: plan.id }],
        })
      )
    }

    const unchecked = plan.devices.filter(
      (device) =>
        device.kind !== 'service-cosigner' &&
        !everDone(ctx, 'device-firmware', { type: 'device', id: device.id })
    )
    if (unchecked.length > 0) {
      findings.push(
        makeFinding(plan, {
          rule: 'T005',
          key: 'devices',
          title: `${names(unchecked.map((device) => device.label))} ${unchecked.length === 1 ? 'has' : 'have'} never been checked`,
          detail:
            'Batteries leak, firmware ages out of support, and a device that has sat in a drawer for four years is an assumption with corrosion on it.',
          remediation: 'Power each device on, confirm it still unlocks, and record the date.',
          subjects: unchecked.map((device) => ({ type: 'device' as const, id: device.id })),
        })
      )
    }
  }

  return findings
}

export function describeKind(kind: Verification['kind']): string {
  const labels: Record<Verification['kind'], string> = {
    'backup-restore': 'A backup restore test',
    'config-backup-restore': 'A wallet configuration restore test',
    'spend-test': 'A spend test',
    'recovery-drill': 'A recovery drill',
    'successor-dry-run': 'A successor dry run',
    'location-access': 'A location access check',
    'device-firmware': 'A device check',
    'passphrase-recall': 'A passphrase recall check',
    'inventory-check': 'An inventory check',
  }
  return labels[kind]
}
