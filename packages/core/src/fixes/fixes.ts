/**
 * Changes that close findings, found by trying them.
 *
 * A finding says what is wrong and, in a sentence, what to do. Turning the
 * sentence into the change was the reader's job: which backup, moved where,
 * and whether moving it opens something worse. That last part is the one
 * nobody can do in their head, and it is exactly what the engine already
 * answers. So this does not reason about fixes at all. It proposes every
 * small, concrete change a person could actually make, runs the whole
 * analysis on each, and keeps the ones that close something without opening
 * anything as bad.
 *
 * There is no second evaluator here. Whether a change helps is decided by
 * `analyze`, the same function every other screen reads, so a fix cannot
 * claim to close a finding the findings list would still show.
 *
 * Two kinds of change are kept apart. Structural ones (move a backup, add a
 * copy, open a place somewhere else) are things you would go and do, and may
 * be applied in bulk to a draft. Records (a check you did today, a successor
 * you told) assert something happened in the world, so they are only ever
 * offered one at a time, against the finding that asks for them, and never
 * applied on the reader's behalf.
 */

import type { Id, Key, Plan, Verification, VerificationKind } from '../model/types.ts'
import { analyze } from '../analysis/analyze.ts'
import type { Finding, Severity } from '../analysis/findings.ts'
import {
  createBackup,
  createConfigBackup,
  createDevice,
  createKey,
  createLocation,
  createPerson,
  createVerification,
  today as todayDate,
} from '../model/factory.ts'

export type FixKind = 'structure' | 'record'

export interface Fix {
  /** Stable for the same change on the same plan. */
  id: string
  kind: FixKind
  /** What you would do, in the imperative. */
  label: string
  apply: (plan: Plan) => void
}

export interface RankedFix {
  fix: Fix
  /** The plan with the change made. */
  plan: Plan
  closes: Finding[]
  opens: Finding[]
  /** Weighted closed minus weighted opened. Positive is better. */
  gain: number
}

const WEIGHT: Record<Severity, number> = { critical: 100, high: 30, medium: 10, low: 3, info: 1 }
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function nextLetter(taken: string[], stem: string): string {
  for (const letter of LETTERS) if (!taken.includes(`${stem} ${letter}`)) return `${stem} ${letter}`
  return `${stem} ${taken.length + 1}`
}

/** Every small change worth trying on this plan. */
export function candidateFixes(plan: Plan, today = todayDate()): Fix[] {
  const fixes: Fix[] = []
  const place = (id: Id | null) =>
    plan.locations.find((entry) => entry.id === id)?.label ?? 'nowhere'
  const keyOf = (plan: Plan, id: Id) => plan.keys.find((entry) => entry.id === id) as Key

  // Places in other regions, created on demand. A far place this program
  // already made is reused before another is invented, so fixes applied one
  // after another share a Site D rather than scattering a D, an E and an F.
  const ours = (draft: Plan) =>
    draft.locations.filter(
      (entry) => entry.kind === 'other' && entry.disasterGroup === `Area ${entry.label.slice(-1)}`
    )
  const farPlaces = (draft: Plan, count: number): Id[] => {
    const found = ours(draft).map((entry) => entry.id)
    while (found.length < count) {
      const label = nextLetter(
        draft.locations.map((entry) => entry.label),
        'Site'
      )
      const created = createLocation({
        label,
        kind: 'other',
        travelMinutes: 180,
        disasterGroup: `Area ${label.slice(-1)}`,
      })
      draft.locations.push(created)
      found.push(created.id)
    }
    return found.slice(0, count)
  }
  const ensureFar = (draft: Plan): Id => farPlaces(draft, 1)[0]
  const farLabel =
    ours(plan)[0]?.label ??
    nextLetter(
      plan.locations.map((entry) => entry.label),
      'Site'
    )

  for (const key of plan.keys) {
    if (key.heldBy) continue
    for (const backup of key.backups) {
      for (const location of plan.locations) {
        if (location.id === backup.locationId) continue
        fixes.push({
          id: `move-backup:${backup.id}:${location.id}`,
          kind: 'structure',
          label: `Move ${key.label}'s ${backup.label.toLowerCase()} to ${location.label}`,
          apply: (draft) => {
            const target = keyOf(draft, key.id).backups.find((entry) => entry.id === backup.id)
            if (target) target.locationId = location.id
          },
        })
      }
      fixes.push({
        id: `move-backup-far:${backup.id}`,
        kind: 'structure',
        label: `Move ${key.label}'s ${backup.label.toLowerCase()} to a new place in another region (${farLabel})`,
        apply: (draft) => {
          const far = ensureFar(draft)
          const target = keyOf(draft, key.id).backups.find((entry) => entry.id === backup.id)
          if (target) target.locationId = far
        },
      })
      if (backup.medium === 'paper' || backup.medium === 'plain-digital') {
        fixes.push({
          id: `steel:${backup.id}`,
          kind: 'structure',
          label: `Put ${key.label}'s ${backup.label.toLowerCase()} on steel`,
          apply: (draft) => {
            const target = keyOf(draft, key.id).backups.find((entry) => entry.id === backup.id)
            if (target) target.medium = 'steel'
          },
        })
      }
    }
    if (key.deviceId) {
      for (const location of plan.locations) {
        if (location.id === key.deviceLocationId) continue
        fixes.push({
          id: `move-device:${key.id}:${location.id}`,
          kind: 'structure',
          label: `Keep ${key.label}'s device at ${location.label} instead of ${place(key.deviceLocationId)}`,
          apply: (draft) => {
            keyOf(draft, key.id).deviceLocationId = location.id
          },
        })
      }
    }
    for (const location of plan.locations) {
      if (key.backups.some((backup) => backup.locationId === location.id)) continue
      fixes.push({
        id: `add-backup:${key.id}:${location.id}`,
        kind: 'structure',
        label: `Add a second steel backup of ${key.label} at ${location.label}`,
        apply: (draft) => {
          keyOf(draft, key.id).backups.push(
            createBackup({ label: 'Steel plate 2', medium: 'steel', locationId: location.id })
          )
        },
      })
    }
  }

  for (const wallet of plan.wallets) {
    const multisig = wallet.paths.some((path) => path.keyIds.length > 1)
    if (multisig) {
      for (const location of plan.locations) {
        if (wallet.configBackups.some((backup) => backup.locationId === location.id)) continue
        fixes.push({
          id: `add-config:${wallet.id}:${location.id}`,
          kind: 'structure',
          label: `Keep a copy of ${wallet.label}'s descriptor at ${location.label}`,
          apply: (draft) => {
            draft.wallets
              .find((entry) => entry.id === wallet.id)
              ?.configBackups.push(
                createConfigBackup({
                  label: `Descriptor at ${location.label}`,
                  locationId: location.id,
                })
              )
          },
        })
      }
      fixes.push({
        id: `add-config-far:${wallet.id}`,
        kind: 'structure',
        label: `Keep a copy of ${wallet.label}'s descriptor at a new place in another region (${farLabel})`,
        apply: (draft) => {
          const far = ensureFar(draft)
          draft.wallets
            .find((entry) => entry.id === wallet.id)
            ?.configBackups.push(
              createConfigBackup({ label: `Descriptor at ${farLabel}`, locationId: far })
            )
        },
      })
    }

    // A single-key wallet worth protecting becomes two of three: the key it
    // has, and two new ones whose devices and backups go where the plan holds
    // least. The change people are usually told to make, made concretely.
    const only = wallet.paths.length === 1 ? wallet.paths[0] : null
    if (only && only.keyIds.length === 1 && wallet.tier !== 'hot' && plan.locations.length > 0) {
      const taken = plan.keys.map((entry) => entry.label)
      const first = nextLetter(taken, 'Key')
      const second = nextLetter([...taken, first], 'Key')
      fixes.push({
        id: `upgrade:${wallet.id}`,
        kind: 'structure',
        label: `Make ${wallet.label} two of three: add ${first} and ${second}, each in a region of its own, with the descriptor kept in every one`,
        apply: (draft) => {
          // Three keys need three regions, or the quorum sits in one of them.
          const regions = new Map<string, Id>()
          for (const entry of draft.locations)
            if (!regions.has(entry.disasterGroup ?? entry.id))
              regions.set(entry.disasterGroup ?? entry.id, entry.id)
          const spread = [...regions.values()]
          if (spread.length < 3)
            for (const id of farPlaces(draft, 3 - spread.length + ours(draft).length))
              if (!spread.includes(id)) spread.push(id)
          const target = draft.wallets.find((entry) => entry.id === wallet.id)
          const path = target?.paths[0]
          if (!target || !path) return
          ;[first, second].forEach((label, index) => {
            const device = createDevice({ label: `Signer ${label.slice(-1)}` })
            // One key's material per region: losing a region loses one key
            // and leaves two, and standing in one holds one key and not two.
            const at = spread[(index + 1) % spread.length]
            const backupAt = at
            draft.devices.push(device)
            const key = createKey({
              label,
              deviceId: device.id,
              deviceLocationId: at,
              backups: [
                createBackup({ label: 'Steel plate', medium: 'steel', locationId: backupAt }),
              ],
            })
            draft.keys.push(key)
            path.keyIds.push(key.id)
          })
          path.threshold = 2
          for (const id of spread) {
            const label = draft.locations.find((entry) => entry.id === id)?.label ?? 'a place'
            target.configBackups.push(
              createConfigBackup({ label: `Descriptor at ${label}`, locationId: id })
            )
          }
        },
      })
    }

    // One more key on the main path, placed where the plan holds least, so
    // the wallet gains a spare rather than a new single point of failure.
    const path = wallet.paths.find((entry) => entry.kind === 'primary') ?? wallet.paths[0]
    if (path && path.keyIds.length > 1 && plan.locations.length > 1) {
      const load = new Map(plan.locations.map((location) => [location.id, 0]))
      for (const key of plan.keys) {
        if (key.deviceLocationId)
          load.set(key.deviceLocationId, (load.get(key.deviceLocationId) ?? 0) + 1)
        for (const backup of key.backups)
          if (backup.locationId) load.set(backup.locationId, (load.get(backup.locationId) ?? 0) + 1)
      }
      const [first, second] = [...load.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)
      const label = nextLetter(
        plan.keys.map((entry) => entry.label),
        'Key'
      )
      fixes.push({
        id: `add-key:${wallet.id}`,
        kind: 'structure',
        label: `Add ${label} to ${wallet.label}, device at ${place(first)} and backup at ${place(second)}`,
        apply: (draft) => {
          const device = createDevice({ label: `Signer ${label.slice(-1)}` })
          const key = createKey({
            label,
            deviceId: device.id,
            deviceLocationId: first,
            backups: [createBackup({ label: 'Steel plate', medium: 'steel', locationId: second })],
          })
          draft.devices.push(device)
          draft.keys.push(key)
          const target = draft.wallets
            .find((entry) => entry.id === wallet.id)
            ?.paths.find((entry) => entry.id === path.id)
          target?.keyIds.push(key.id)
        },
      })
    }
  }

  const successors = plan.people.filter(
    (person) => person.role === 'successor' || person.role === 'executor'
  )
  for (const person of successors) {
    for (const location of plan.locations) {
      if (location.access.some((access) => access.personId === person.id)) continue
      fixes.push({
        id: `access:${person.id}:${location.id}`,
        kind: 'structure',
        label: `Arrange for ${person.label} to open ${location.label} after your death`,
        apply: (draft) => {
          draft.locations
            .find((entry) => entry.id === location.id)
            ?.access.push({ personId: person.id, condition: 'after-death', delayDays: 0 })
        },
      })
    }
    if (!person.knowsPlanExists || !person.knowsWhereInstructionsAre) {
      fixes.push({
        id: `tell:${person.id}`,
        kind: 'record',
        label: `I have told ${person.label} the plan exists and where the instructions are`,
        apply: (draft) => {
          const target = draft.people.find((entry) => entry.id === person.id)
          if (target) {
            target.knowsPlanExists = true
            target.knowsWhereInstructionsAre = true
          }
        },
      })
    }
  }
  if (successors.length === 0 && plan.locations.length > 0) {
    const home = plan.locations[0]
    fixes.push({
      id: 'add-successor',
      kind: 'structure',
      label: `Name a successor who can open ${home.label} after your death`,
      apply: (draft) => {
        const person = createPerson({
          label: 'Successor 1',
          knowsPlanExists: true,
          availability: 'days',
        })
        draft.people.push(person)
        draft.locations
          .find((entry) => entry.id === home.id)
          ?.access.push({ personId: person.id, condition: 'after-death', delayDays: 0 })
      },
    })
  }

  // Records: a check done today. Offered for every check the plan could have,
  // existing or not, and never applied in bulk.
  const checks: { kind: VerificationKind; subject: Verification['subject']; label: string }[] = [
    ...plan.keys
      .filter((key) => key.backups.length > 0)
      .map((key) => ({
        kind: 'backup-restore' as const,
        subject: { type: 'key' as const, id: key.id },
        label: `I restored ${key.label}'s backup today and it matched`,
      })),
    ...plan.wallets.map((wallet) => ({
      kind: 'spend-test' as const,
      subject: { type: 'wallet' as const, id: wallet.id },
      label: `I sent a small amount out of ${wallet.label} today`,
    })),
    ...plan.wallets
      .filter((wallet) => wallet.configBackups.length > 0)
      .map((wallet) => ({
        kind: 'config-backup-restore' as const,
        subject: { type: 'wallet' as const, id: wallet.id },
        label: `I rebuilt ${wallet.label} from its written descriptor today`,
      })),
    ...successors.map((person) => ({
      kind: 'successor-dry-run' as const,
      subject: { type: 'person' as const, id: person.id },
      label: `${person.label} rehearsed the recovery today`,
    })),
    ...plan.devices.map((device) => ({
      kind: 'device-firmware' as const,
      subject: { type: 'device' as const, id: device.id },
      label: `I checked ${device.label}'s firmware today`,
    })),
  ]
  // The same check across everything it applies to, for the findings that
  // are about all of them at once.
  const grouped = new Map<VerificationKind, typeof checks>()
  for (const check of checks) grouped.set(check.kind, [...(grouped.get(check.kind) ?? []), check])
  const everyLabel: Partial<Record<VerificationKind, string>> = {
    'backup-restore': 'I restored every key backup today and each one matched',
    'device-firmware': 'I checked the firmware on every device today',
    'spend-test': 'I sent a small amount out of every wallet today',
  }
  for (const [kind, group] of grouped) {
    const label = everyLabel[kind]
    if (!label || group.length < 2) continue
    checks.push({ kind, subject: { type: 'plan', id: `every-${kind}` }, label })
  }

  for (const check of checks) {
    if (check.subject.type === 'plan') {
      const group = grouped.get(check.kind) ?? []
      fixes.push({
        id: `check-all:${check.kind}`,
        kind: 'record',
        label: check.label,
        apply: (draft) => {
          for (const member of group) {
            const existing = draft.verifications.find(
              (entry) => entry.kind === member.kind && entry.subject.id === member.subject.id
            )
            if (existing) existing.lastVerifiedAt = today
            else
              draft.verifications.push(
                createVerification({
                  kind: member.kind,
                  subject: member.subject,
                  lastVerifiedAt: today,
                })
              )
          }
        },
      })
      continue
    }
    fixes.push({
      id: `check:${check.kind}:${check.subject.id}`,
      kind: 'record',
      label: check.label,
      apply: (draft) => {
        const existing = draft.verifications.find(
          (entry) => entry.kind === check.kind && entry.subject.id === check.subject.id
        )
        if (existing) existing.lastVerifiedAt = today
        else
          draft.verifications.push(
            createVerification({ kind: check.kind, subject: check.subject, lastVerifiedAt: today })
          )
      },
    })
  }

  return fixes
}

function score(findings: Finding[]): number {
  return findings.reduce((sum, finding) => sum + WEIGHT[finding.severity], 0)
}

/** Try one change and report what it does. */
export function tryFix(plan: Plan, fix: Fix, before: Finding[], today?: string): RankedFix {
  const draft = structuredClone(plan)
  fix.apply(draft)
  const after = analyze(draft, { includeScenarios: false, today }).findings
  const was = new Set(before.map((finding) => finding.id))
  const now = new Set(after.map((finding) => finding.id))
  const closes = before.filter((finding) => !now.has(finding.id))
  const opens = after.filter((finding) => !was.has(finding.id))
  return { fix, plan: draft, closes, opens, gain: score(closes) - score(opens) }
}

/**
 * The changes that close one finding, best first.
 *
 * Best is: opens nothing, then closes the most. A change that closes this
 * finding and opens one as severe is not offered at all, because trading one
 * critical for another is not a fix, it is a different plan.
 */
export function fixesFor(
  plan: Plan,
  findingId: string,
  options: { limit?: number; today?: string } = {}
): RankedFix[] {
  const before = analyze(plan, { includeScenarios: false, today: options.today }).findings
  const target = before.find((finding) => finding.id === findingId)
  if (!target) return []
  const acceptable = (result: RankedFix) =>
    result.closes.some((finding) => finding.id === findingId) &&
    result.gain > 0 &&
    !result.opens.some((finding) => WEIGHT[finding.severity] >= WEIGHT[target.severity])
  const tried = candidateFixes(plan, options.today).map((fix) =>
    tryFix(plan, fix, before, options.today)
  )
  const ranked = tried
    .filter(acceptable)
    .sort((a, b) => score(a.opens) - score(b.opens) || b.gain - a.gain)
  if (ranked.length > 0) return ranked.slice(0, options.limit ?? 3)

  // No one change does it. Try two, starting from the first moves that cost
  // least, and offer the best pair as a single fix: most concentration
  // problems are a backup moving out and something else following it.
  const firsts = tried
    .filter((result) => result.fix.kind === 'structure')
    .filter((result) => !result.opens.some((finding) => finding.severity === 'critical'))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, LOOKAHEAD * 2)
  let best: RankedFix | null = null
  for (const first of firsts) {
    for (const second of candidateFixes(first.plan, options.today)) {
      if (second.kind !== 'structure') continue
      const combined: Fix = {
        id: `${first.fix.id}+${second.id}`,
        kind: 'structure',
        label: `${first.fix.label}, and ${lower(second.label)}`,
        apply: (draft) => {
          first.fix.apply(draft)
          second.apply(draft)
        },
      }
      const result = tryFix(plan, combined, before, options.today)
      if (acceptable(result) && (!best || result.gain > best.gain)) best = result
    }
  }
  return best ? [best] : []
}

function lower(text: string): string {
  // "Keep a copy" reads as a clause after "and"; a label that starts with a
  // name ("Successor 1 rehearsed") keeps its capital.
  return /^(Move|Keep|Add|Put|Arrange|Make|Name) /.test(text)
    ? text[0].toLowerCase() + text.slice(1)
    : text
}

export interface Improvement {
  plan: Plan
  steps: RankedFix[]
}

/**
 * Apply the best structural change, again and again, while each one helps.
 *
 * Greedy, and deliberately so: every step is one change a person could make,
 * the list of them is the plan of work, and a search that jumped to a
 * distant optimum would hand back a plan nobody could get to from here. Only
 * structural changes; a record of something done is the reader's to make.
 */
export function improve(
  plan: Plan,
  options: { maxSteps?: number; today?: string } = {}
): Improvement {
  let current = plan
  const steps: RankedFix[] = []
  for (let step = 0; step < (options.maxSteps ?? 6); step += 1) {
    const before = analyze(current, { includeScenarios: false, today: options.today }).findings
    const tried = candidateFixes(current, options.today)
      .filter((fix) => fix.kind === 'structure')
      .map((fix) => tryFix(current, fix, before, options.today))
      // Never trade into a new critical, however much it closes.
      .filter((result) => !result.opens.some((finding) => finding.severity === 'critical'))
      .sort((a, b) => b.gain - a.gain)
    const best = tried[0]
    if (best && best.gain > 0) {
      steps.push(best)
      current = best.plan
      continue
    }
    // Nothing helps on its own. Most real fixes are two moves: a backup goes
    // somewhere new and something else follows it. So look one step further,
    // from the few first moves that cost least.
    const pair = lookahead(current, before, tried.slice(0, LOOKAHEAD), options.today)
    if (!pair) break
    steps.push(...pair)
    current = pair[1].plan
  }
  return { plan: current, steps }
}

/** How many first moves are followed up when no single move helps. */
const LOOKAHEAD = 8

function lookahead(
  plan: Plan,
  before: Finding[],
  firsts: RankedFix[],
  today?: string
): [RankedFix, RankedFix] | null {
  let best: [RankedFix, RankedFix] | null = null
  let bestGain = 0
  for (const first of firsts) {
    const middle = analyze(first.plan, { includeScenarios: false, today }).findings
    for (const fix of candidateFixes(first.plan, today)) {
      if (fix.kind !== 'structure') continue
      const second = tryFix(first.plan, fix, middle, today)
      if (second.opens.some((finding) => finding.severity === 'critical')) continue
      // Judged end to end against where it started, not step by step.
      const total = tryFix(
        plan,
        {
          ...fix,
          apply: (draft) => {
            first.fix.apply(draft)
            fix.apply(draft)
          },
        },
        before,
        today
      )
      if (total.opens.some((finding) => finding.severity === 'critical')) continue
      if (total.gain > bestGain) {
        bestGain = total.gain
        best = [first, second]
      }
    }
  }
  return best
}
