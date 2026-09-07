/**
 * Comparing two plans.
 *
 * Comparing candidates is the main thing a planner is for. The interesting
 * question is never "is this plan good", which has no answer, but "does moving
 * Key B to the other city close more than it opens", which does.
 *
 * Findings are matched by id, and finding ids are built from the rule plus the
 * objects it is about. A draft derived from a plan keeps those object ids, so
 * the match is exact where it matters. Two unrelated plans will match almost
 * nothing, which is why the rule-level summary exists alongside.
 */

import type { AnalysisReport } from '../analysis/analyze.ts'
import type { Finding, RuleId, Severity } from '../analysis/findings.ts'
import { SEVERITY_ORDER, sortFindings } from '../analysis/findings.ts'
import type { Plan } from '../model/types.ts'

export interface FindingDelta {
  /** Present in the first plan and gone in the second. */
  resolved: Finding[]
  /** New in the second plan. */
  introduced: Finding[]
  /** In both, unchanged in severity. */
  unchanged: Finding[]
  /** In both, with a different severity. */
  changed: { before: Finding; after: Finding }[]
  /** Count by severity, second minus first. Negative is an improvement. */
  severityDelta: Record<Severity, number>
  /** Rules that appear in one and not the other, regardless of subject. */
  rulesResolved: RuleId[]
  rulesIntroduced: RuleId[]
}

export function compareReports(before: AnalysisReport, after: AnalysisReport): FindingDelta {
  const beforeById = new Map(before.findings.map((finding) => [finding.id, finding]))
  const afterById = new Map(after.findings.map((finding) => [finding.id, finding]))

  const resolved: Finding[] = []
  const unchanged: Finding[] = []
  const changed: { before: Finding; after: Finding }[] = []
  for (const [id, finding] of beforeById) {
    const next = afterById.get(id)
    if (!next) resolved.push(finding)
    else if (next.severity !== finding.severity) changed.push({ before: finding, after: next })
    else unchanged.push(finding)
  }
  const introduced = [...afterById]
    .filter(([id]) => !beforeById.has(id))
    .map(([, finding]) => finding)

  const severityDelta = {} as Record<Severity, number>
  for (const severity of SEVERITY_ORDER) {
    severityDelta[severity] = after.counts[severity] - before.counts[severity]
  }

  const beforeRules = new Set(before.findings.map((finding) => finding.rule))
  const afterRules = new Set(after.findings.map((finding) => finding.rule))

  return {
    resolved: sortFindings(resolved),
    introduced: sortFindings(introduced),
    unchanged: sortFindings(unchanged),
    changed: changed.sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.after.severity) - SEVERITY_ORDER.indexOf(b.after.severity)
    ),
    severityDelta,
    rulesResolved: [...beforeRules].filter((rule) => !afterRules.has(rule)),
    rulesIntroduced: [...afterRules].filter((rule) => !beforeRules.has(rule)),
  }
}

// --- what actually changed in the plan --------------------------------------

export type ChangeKind = 'added' | 'removed' | 'changed'

export interface PlanChange {
  kind: ChangeKind
  entity: 'location' | 'person' | 'device' | 'key' | 'wallet' | 'verification'
  id: string
  label: string
  /** For a change, the fields that differ, in the model's own words. */
  fields: string[]
}

type Labelled = { id: string; label?: string; name?: string }

function labelOf(entity: Labelled): string {
  return entity.label ?? entity.name ?? entity.id
}

function diffEntities<T extends Labelled>(
  entity: PlanChange['entity'],
  before: readonly T[],
  after: readonly T[]
): PlanChange[] {
  const changes: PlanChange[] = []
  const beforeById = new Map(before.map((item) => [item.id, item]))
  const afterById = new Map(after.map((item) => [item.id, item]))

  for (const [id, item] of beforeById) {
    const next = afterById.get(id)
    if (!next) {
      changes.push({ kind: 'removed', entity, id, label: labelOf(item), fields: [] })
      continue
    }
    const fields = changedFields(item, next)
    if (fields.length > 0) {
      changes.push({ kind: 'changed', entity, id, label: labelOf(next), fields })
    }
  }
  for (const [id, item] of afterById) {
    if (!beforeById.has(id)) {
      changes.push({ kind: 'added', entity, id, label: labelOf(item), fields: [] })
    }
  }
  return changes
}

function changedFields(before: unknown, after: unknown, prefix = ''): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return []
  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    Array.isArray(before) !== Array.isArray(after)
  ) {
    return [prefix || 'value']
  }
  if (Array.isArray(before)) return [prefix || 'list']
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const fields: string[] = []
  for (const key of keys) {
    if (key === 'id') continue
    const path = prefix ? `${prefix}.${key}` : key
    fields.push(
      ...changedFields(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        path
      )
    )
  }
  return fields
}

export function comparePlans(before: Plan, after: Plan): PlanChange[] {
  return [
    ...diffEntities('location', before.locations, after.locations),
    ...diffEntities('person', before.people, after.people),
    ...diffEntities('device', before.devices, after.devices),
    ...diffEntities('key', before.keys, after.keys),
    ...diffEntities('wallet', before.wallets, after.wallets),
    ...diffEntities(
      'verification',
      before.verifications.map((entry) => ({ ...entry, label: entry.kind })),
      after.verifications.map((entry) => ({ ...entry, label: entry.kind }))
    ),
  ]
}

/** One line summarising whether the second plan is better, in plain terms. */
export function summariseDelta(delta: FindingDelta): string {
  const worse = delta.severityDelta.critical + delta.severityDelta.high
  const closed = delta.resolved.length
  const opened = delta.introduced.length
  if (closed === 0 && opened === 0)
    return 'The findings are identical. Nothing this changed was load-bearing.'
  if (opened === 0)
    return `Closes ${closed} ${closed === 1 ? 'finding' : 'findings'} and opens none.`
  if (closed === 0)
    return `Opens ${opened} new ${opened === 1 ? 'finding' : 'findings'} and closes none.`
  const direction =
    worse < 0
      ? 'and the serious ones go down'
      : worse > 0
        ? 'and the serious ones go up'
        : 'with no net change at the top'
  return `Closes ${closed}, opens ${opened}, ${direction}.`
}
