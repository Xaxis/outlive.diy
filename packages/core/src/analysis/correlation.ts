/**
 * Correlation: which independent-looking failures are actually one failure.
 *
 * A 2-of-3 is a claim about independence, and independence is the part nobody
 * checks. Three keys from one maker are one decision. Three sites in one flood
 * plain are one storm. Three backups one person can reach are one person.
 */

import type { Finding } from './findings.ts'
import { escalate, makeFinding, walletWeight } from './findings.ts'
import type { AnalysisContext } from './context.ts'
import {
  devicesByArchitecture,
  devicesByVendor,
  keyLocationIds,
  locationsReachableBy,
} from '../model/selectors.ts'
import type { Device, Id, Key, SpendPath, Wallet } from '../model/types.ts'

function names(items: readonly string[]): string {
  if (items.length === 0) return 'nothing'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Paths worth reasoning about: they can be used today and need more than one key. */
function realPaths(wallet: Wallet): SpendPath[] {
  return wallet.paths.filter((path) => path.timelockDays === 0 && path.threshold > 1)
}

export interface CorrelationInput {
  /** People already reported by the compromise analysis, to avoid saying it twice. */
  spendingPeople: ReadonlySet<Id>
}

export function analyseCorrelation(ctx: AnalysisContext, input: CorrelationInput): Finding[] {
  const { plan, index } = ctx
  const findings: Finding[] = []

  const groupKeysBy = (
    path: SpendPath,
    groups: Map<string, Device[]>
  ): Map<string, { label: string; keys: Key[] }> => {
    const out = new Map<string, { label: string; keys: Key[] }>()
    for (const [groupKey, devices] of groups) {
      const keys = path.keyIds
        .map((id) => index.keys.get(id))
        .filter((key): key is Key => !!key && devices.some((device) => device.id === key.deviceId))
      if (keys.length === 0) continue
      out.set(groupKey, { label: devices[0].vendor ?? devices[0].architecture ?? groupKey, keys })
    }
    return out
  }

  for (const wallet of plan.wallets) {
    if (wallet.decoy) continue
    const weight = walletWeight(wallet)

    for (const path of realPaths(wallet)) {
      // --- one vendor -------------------------------------------------------
      for (const [vendorKey, group] of groupKeysBy(path, devicesByVendor(plan))) {
        if (group.keys.length < path.threshold) continue
        findings.push(
          makeFinding(plan, {
            rule: 'R001',
            key: `${wallet.id}:${path.id}:${vendorKey}`,
            title: `${wallet.label} depends on ${group.label} for a full quorum`,
            detail: `${path.label} is ${path.threshold}-of-${path.keyIds.length}, and ${group.keys.length} of those keys sit on ${group.label} hardware: ${names(group.keys.map((key) => key.label))}. The threshold reads as ${path.threshold} independent decisions and is really one vendor.`,
            remediation: `Move at least ${group.keys.length - path.threshold + 1} of those keys to hardware from a different maker.`,
            subjects: [
              { type: 'wallet', id: wallet.id },
              ...group.keys.map((key) => ({ type: 'key' as const, id: key.id })),
            ],
            severity: escalate('high', weight),
          })
        )
      }

      // --- one architecture -------------------------------------------------
      for (const [archKey, group] of groupKeysBy(path, devicesByArchitecture(plan))) {
        if (group.keys.length < path.threshold) continue
        const vendors = new Set(
          group.keys.map((key) => index.devices.get(key.deviceId ?? '')?.vendor ?? '')
        )
        // Only worth saying when the vendors differ; otherwise R001 already said it.
        if (vendors.size < 2) continue
        findings.push(
          makeFinding(plan, {
            rule: 'R002',
            key: `${wallet.id}:${path.id}:${archKey}`,
            title: `${wallet.label}'s quorum shares one hardware architecture`,
            detail: `${names(group.keys.map((key) => key.label))} run on ${group.label}, across more than one brand. Different logos, one silicon and firmware lineage, one class of vulnerability.`,
            remediation: 'Diversify the architecture behind the threshold, not only the brand.',
            subjects: [
              { type: 'wallet', id: wallet.id },
              ...group.keys.map((key) => ({ type: 'key' as const, id: key.id })),
            ],
            severity: escalate('medium', weight),
          })
        )
      }

      // --- one disaster group -----------------------------------------------
      const byGroup = new Map<string, Set<Id>>()
      for (const keyId of path.keyIds) {
        const key = index.keys.get(keyId)
        if (!key) continue
        for (const locationId of keyLocationIds(plan, key)) {
          const group = index.locations.get(locationId)?.disasterGroup
          if (!group) continue
          const existing = byGroup.get(group)
          if (existing) existing.add(keyId)
          else byGroup.set(group, new Set([keyId]))
        }
      }
      for (const [group, keyIds] of byGroup) {
        if (keyIds.size < path.threshold) continue
        const members = plan.locations.filter((location) => location.disasterGroup === group)
        findings.push(
          makeFinding(plan, {
            rule: 'R003',
            key: `${wallet.id}:${path.id}:${group}`,
            title: `${wallet.label}'s quorum is concentrated in "${group}"`,
            detail: `${keyIds.size} of the ${path.keyIds.length} keys on ${path.label} have material inside "${group}" (${names(members.map((m) => m.label))}), and the threshold is ${path.threshold}. One event in that group is simultaneously enough to destroy the wallet and, if it is a burglary rather than a fire, enough to spend it.`,
            remediation: `Relocate material for at least ${keyIds.size - path.threshold + 1} ${keyIds.size - path.threshold + 1 === 1 ? 'key' : 'keys'} outside "${group}".`,
            subjects: [
              { type: 'wallet', id: wallet.id },
              ...members.map((member) => ({ type: 'location' as const, id: member.id })),
            ],
            severity: escalate('critical', weight),
          })
        )
      }

      // --- one person -------------------------------------------------------
      for (const person of plan.people) {
        if (input.spendingPeople.has(person.id)) continue
        const reachable = new Set(
          locationsReachableBy(plan, person.id, 'always').map((entry) => entry.location.id)
        )
        if (reachable.size === 0) continue
        const reachableKeys = path.keyIds.filter((keyId) => {
          const key = index.keys.get(keyId)
          if (!key) return false
          return key.backups.some(
            (backup) => backup.locationId !== null && reachable.has(backup.locationId)
          )
        })
        if (reachableKeys.length < path.threshold) continue
        findings.push(
          makeFinding(plan, {
            rule: 'R004',
            key: `${wallet.id}:${path.id}:${person.id}`,
            title: `${person.label} can reach a quorum of ${wallet.label}'s backups`,
            detail: `${person.label} has standing access to places holding ${reachableKeys.length} of ${wallet.label}'s keys, against a threshold of ${path.threshold}. Something else is currently stopping them from spending, and the threshold is not it.`,
            remediation: `Reduce ${person.label}'s standing access so it covers fewer than ${path.threshold} keys.`,
            subjects: [
              { type: 'wallet', id: wallet.id },
              { type: 'person', id: person.id },
            ],
            severity: escalate('high', weight),
          })
        )
      }
    }
  }

  // --- one legal system -------------------------------------------------------
  //
  // Distance is measured in more than kilometres. Two vaults four hundred miles
  // apart are one container as far as a seizure order is concerned.
  if (
    plan.profile.jurisdictionCount === 1 &&
    plan.profile.concerns.includes('legal-seizure') &&
    plan.locations.length >= 2
  ) {
    findings.push(
      makeFinding(plan, {
        rule: 'R006',
        key: 'jurisdiction',
        title: `All ${plan.locations.length} places are inside one legal system`,
        detail: `Legal seizure is a stated concern and the plan spans one jurisdiction, so ${names(
          plan.locations.map((location) => location.label)
        )} are one container as far as a court order, a change of law or a frozen estate is concerned, however far apart they are.`,
        remediation:
          'Put one key beyond that legal system, or accept explicitly that geographic separation here is protection against fire and theft and not against law.',
        subjects: plan.locations.map((location) => ({
          type: 'location' as const,
          id: location.id,
        })),
      })
    )
  }

  // --- one supply route -------------------------------------------------------
  const devices = plan.devices.filter((device) => device.kind !== 'service-cosigner')
  if (devices.length >= 2) {
    const routes = new Set(devices.map((device) => device.supplyChain))
    const route = [...routes][0]
    if (routes.size === 1 && route !== 'direct-from-vendor') {
      findings.push(
        makeFinding(plan, {
          rule: 'R005',
          key: 'supply',
          title: `Every device came through the same route (${route.replace(/-/g, ' ')})`,
          detail: `All ${devices.length} devices in this plan share one acquisition path. Interception, a tampered batch and a dishonest reseller all apply to the whole set at once, which is the same shape of problem as a shared vendor.`,
          remediation:
            'Buy at least one device directly from its manufacturer, at a different time, to a different address.',
          subjects: devices.map((device) => ({ type: 'device' as const, id: device.id })),
        })
      )
    }
  }

  return findings
}
