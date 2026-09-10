'use client'

import { useMemo } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import {
  buildGraph,
  baseWorld,
  disasterGroups,
  type AnalysisReport,
  type Finding,
  type Plan,
} from '@outlive/core'
import { Panel } from '@/components/ui/Surface.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { navigateTo } from '@/lib/router.ts'
import { useStore, type EntityKind } from '@/lib/store.ts'

/**
 * What the step just answered, and what the answer cost.
 *
 * A guided route that only collects fields is a form with a progress bar on it.
 * The thing that makes it guidance is that each answer is immediately read back
 * against everything else: describe three places and be told two of them fail
 * together, describe a threshold and be told which single loss ends it.
 *
 * Only findings that name something in this step appear, so a step is never
 * blamed for a problem somewhere else, and the one currently open in the
 * inspector is left out because the inspector is already showing it. Nothing is
 * suppressed anywhere: the whole list is one click away and the count says how
 * many are in it.
 */

const SUBJECT_TYPE: Record<EntityKind, string> = {
  location: 'location',
  person: 'person',
  device: 'device',
  key: 'key',
  wallet: 'wallet',
  verification: 'verification',
}

/** One sentence about the shape of what has been described, not its problems. */
function shapeOf(plan: Plan, kind: EntityKind): string | null {
  if (kind === 'location') {
    if (plan.locations.length === 0) return null
    const groups = disasterGroups(plan)
    const ungrouped = plan.locations.filter((location) => location.disasterGroup === null).length
    const together = [...groups.values()].filter((members) => members.length > 1)
    const parts = [`${plan.locations.length} ${plan.locations.length === 1 ? 'place' : 'places'}`]
    if (together.length > 0) {
      parts.push(
        `${together.map((members) => members.map((m) => m.label).join(' and ')).join('; ')} fail together`
      )
    }
    if (ungrouped > 0) {
      parts.push(
        `${ungrouped} with no disaster group recorded, which the analysis has to treat as independent`
      )
    }
    return `${parts.join('. ')}.`
  }
  if (kind === 'person') {
    if (plan.people.length === 0) return null
    const told = plan.people.filter((person) => person.knowsPlanExists).length
    return `${plan.people.length} ${plan.people.length === 1 ? 'person' : 'people'}, ${told} of whom ${told === 1 ? 'has' : 'have'} been told this plan exists.`
  }
  if (kind === 'key') {
    if (plan.keys.length === 0) return null
    const noBackup = plan.keys.filter((key) => key.backups.length === 0).length
    const together = plan.keys.filter(
      (key) =>
        key.deviceLocationId !== null &&
        key.backups.some((backup) => backup.locationId === key.deviceLocationId)
    ).length
    const parts = [`${plan.keys.length} ${plan.keys.length === 1 ? 'key' : 'keys'}`]
    if (noBackup > 0) parts.push(`${noBackup} with nothing written down`)
    if (together > 0) {
      parts.push(`${together} whose device and backup share a place, which makes them one object`)
    }
    return `${parts.join('. ')}.`
  }
  if (kind === 'wallet') {
    if (plan.wallets.length === 0) return null
    const multisig = plan.wallets.filter((wallet) =>
      wallet.paths.some((path) => path.threshold > 1)
    )
    const noConfig = multisig.filter((wallet) => wallet.configBackups.length === 0).length
    const policies = plan.wallets
      .map((wallet) => {
        const everyday = wallet.paths.find((path) => path.timelockDays === 0) ?? wallet.paths[0]
        if (!everyday) return `${wallet.label} has no way to spend at all`
        return `${wallet.label} spends with ${everyday.threshold} of ${everyday.keyIds.length}`
      })
      .join(', ')
    const parts = [
      `${plan.wallets.length} ${plan.wallets.length === 1 ? 'wallet' : 'wallets'}: ${policies}`,
    ]
    if (noConfig > 0) {
      parts.push(
        `${noConfig} multisig with no configuration copy recorded, which is the failure that makes every seed useless`
      )
    }
    return `${parts.join('. ')}.`
  }
  if (kind === 'device') {
    if (plan.devices.length === 0) return null
    const vendors = new Set(
      plan.devices.map((device) => device.vendor?.trim().toLowerCase()).filter(Boolean)
    )
    return `${plan.devices.length} ${plan.devices.length === 1 ? 'device' : 'devices'} from ${vendors.size || 'an unrecorded number of'} ${vendors.size === 1 ? 'maker' : 'makers'}.`
  }
  if (kind === 'verification') {
    if (plan.verifications.length === 0) return null
    const never = plan.verifications.filter((entry) => entry.lastVerifiedAt === null).length
    return `${plan.verifications.length} ${plan.verifications.length === 1 ? 'check' : 'checks'}, ${never} of which ${never === 1 ? 'has' : 'have'} never been done.`
  }
  return null
}

export function StepEffect({
  plan,
  report,
  kind,
}: {
  plan: Plan
  report: AnalysisReport
  kind: EntityKind
}) {
  const type = SUBJECT_TYPE[kind]
  const selection = useStore((state) => state.selection)
  const mine: Finding[] = useMemo(
    () =>
      report.findings
        .filter((finding) => finding.subjects.some((subject) => subject.type === type))
        .filter(
          (finding) =>
            !selection ||
            !finding.subjects.some(
              (subject) => subject.type === selection.type && subject.id === selection.id
            )
        ),
    [report, type, selection]
  )
  const shape = shapeOf(plan, kind)

  // The wallets step is where the whole structure first exists, so it is the
  // one place a picture says more than a sentence.
  const graph = useMemo(
    () => (kind === 'wallet' && plan.wallets.length > 0 ? buildGraph(plan, baseWorld(plan)) : null),
    [kind, plan]
  )

  if (!shape && mine.length === 0) return null

  return (
    <Panel className="mt-4 p-4">
      <p className="eyebrow mb-2">What this told the analysis</p>
      {shape ? <p className="text-sm leading-relaxed text-body">{shape}</p> : null}

      {graph ? (
        <div className="mt-4">
          <PlanDiagram graph={graph} height="32rem" />
        </div>
      ) : null}

      {mine.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm text-muted">
          <Check className="size-4 flex-none text-ok" aria-hidden />
          Nothing else in this step matched a rule. That is a smaller claim than it sounds like: it
          means only that this program has no rule for whatever is wrong.
        </p>
      ) : (
        <>
          <p className="eyebrow mt-4 border-t border-line pt-3">
            {selection ? 'Elsewhere in this step' : 'What it found'}
          </p>
          <ul className="mt-2 grid gap-2">
            {mine.slice(0, 4).map((finding) => (
              <li key={finding.id} className="flex items-start gap-2">
                <SeverityDot severity={finding.severity} />
                <span className="min-w-0 text-[0.8125rem] leading-snug">
                  <span className="text-body">{finding.title}</span>
                  <span className="ml-1.5 text-faint">{finding.severity}</span>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => navigateTo('findings')}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent underline underline-offset-2"
          >
            {mine.length > 4
              ? `${mine.length - 4} more from this step, and all ${report.findings.length} findings`
              : `All ${report.findings.length} findings`}
            <ArrowRight className="size-3" aria-hidden />
          </button>
        </>
      )}
    </Panel>
  )
}
