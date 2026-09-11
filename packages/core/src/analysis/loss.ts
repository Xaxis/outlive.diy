/**
 * Loss: remove one thing and ask whether the coins can still be moved.
 *
 * Only wallets that work today are examined. A wallet that is already
 * unspendable does not need a fire to explain it, and reporting every possible
 * loss against it would bury the structural finding that actually matters.
 *
 * Noise control matters as much as coverage here. When every key in a wallet is
 * individually fatal, that is one fact about the wallet ("no spare capacity"),
 * not one fact per key, and it is reported as one finding.
 */

import type { Finding } from './findings.ts'
import { escalate, makeFinding, walletWeight } from './findings.ts'
import type { AnalysisContext } from './context.ts'
import { evaluateWallet } from './availability.ts'
import {
  disasterGroupLostScenario,
  locationLostScenario,
  objectLostScenario,
  personLostScenario,
  type Scenario,
} from './scenarios.ts'
import { disasterGroups, walletKeyIds } from '../model/selectors.ts'
import { describeDuration, describeSteps, recoveryTiming } from './timing.ts'
import type { Id, Wallet } from '../model/types.ts'

function names(items: readonly string[]): string {
  if (items.length === 0) return 'nothing'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Wallets that go from spendable to unspendable in this scenario. */
function broken(ctx: AnalysisContext, scenario: Scenario, live: readonly Wallet[]): Wallet[] {
  return live.filter((wallet) => !evaluateWallet(ctx.plan, wallet, scenario.world).spendable)
}

export function analyseLoss(ctx: AnalysisContext): Finding[] {
  const { plan } = ctx
  const findings: Finding[] = []
  const live = plan.wallets.filter((wallet) => evaluateWallet(plan, wallet, ctx.base).spendable)
  if (live.length === 0) return findings

  const worst = (wallets: readonly Wallet[]) =>
    wallets.length === 0 ? 0 : Math.max(...wallets.map((wallet) => walletWeight(wallet)))

  // --- locations ------------------------------------------------------------
  for (const location of plan.locations) {
    const scenario = locationLostScenario(ctx, location.id)
    const hit = broken(ctx, scenario, live)
    if (hit.length === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'L001',
        key: location.id,
        title: `Losing ${location.label} makes ${names(hit.map((w) => w.label))} unspendable`,
        detail: `${location.label} is a single point of failure. One fire, flood, burglary, eviction or lost key to that container ends ${hit.length === 1 ? 'that wallet' : 'those wallets'}.`,
        remediation: `Place a further independent copy of the key material behind ${names(hit.map((w) => w.label))} at a location in a different disaster group.`,
        subjects: [
          { type: 'location', id: location.id },
          ...hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        ],
        world: scenario.label,
        scenarioId: scenario.id,
        severity: escalate('critical', worst(hit)),
      })
    )
  }

  // --- disaster groups ------------------------------------------------------
  for (const [group, members] of disasterGroups(plan)) {
    if (members.length < 2) continue
    const scenario = disasterGroupLostScenario(ctx, group)
    const hit = broken(ctx, scenario, live)
    // Only interesting if the group is worse than its individual members.
    const individually = new Set(
      members
        .flatMap((member) => broken(ctx, locationLostScenario(ctx, member.id), live))
        .map((w) => w.id)
    )
    const extra = hit.filter((wallet) => !individually.has(wallet.id))
    if (extra.length === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'L005',
        key: group,
        title: `One event in "${group}" makes ${names(extra.map((w) => w.label))} unspendable`,
        detail: `${names(members.map((m) => m.label))} share the disaster group "${group}", so they fail on the same day. Individually each is survivable; together they are not.`,
        remediation: `Move the key material at one of ${names(members.map((m) => m.label))} to a location outside "${group}".`,
        subjects: [
          ...members.map((member) => ({ type: 'location' as const, id: member.id })),
          ...extra.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        ],
        world: scenario.label,
        scenarioId: scenario.id,
        severity: escalate('critical', worst(extra)),
      })
    )
  }

  // --- keys -----------------------------------------------------------------
  // A wallet whose every key is fatal is reported once, as a lack of spare
  // capacity, rather than once per key.
  const fatalKeysByWallet = new Map<Id, Id[]>()
  for (const key of plan.keys) {
    const scenario = objectLostScenario(ctx, 'key-lost', key.id, key.label)
    for (const wallet of broken(ctx, scenario, live)) {
      const existing = fatalKeysByWallet.get(wallet.id)
      if (existing) existing.push(key.id)
      else fatalKeysByWallet.set(wallet.id, [key.id])
    }
  }
  for (const [walletId, keyIds] of fatalKeysByWallet) {
    const wallet = ctx.index.wallets.get(walletId)
    if (!wallet) continue
    const all = walletKeyIds(wallet)
    const everyKeyFatal = all.length > 0 && keyIds.length === all.length
    if (everyKeyFatal) {
      findings.push(
        makeFinding(plan, {
          rule: 'L007',
          key: walletId,
          title: `${wallet.label} has no spare keys`,
          detail:
            all.length === 1
              ? `${wallet.label} has one key and needs it. It works today and can absorb nothing: the next loss of any kind is permanent.`
              : `Every one of the ${all.length} keys behind ${wallet.label} is required. It works today and can absorb nothing: the next loss of any kind is permanent.`,
          remediation: `Add a key to ${wallet.label} above its threshold, or reduce the threshold if the current one was not a deliberate choice.`,
          subjects: [
            { type: 'wallet', id: walletId },
            ...keyIds.map((id) => ({ type: 'key' as const, id })),
          ],
          severity: escalate('medium', walletWeight(wallet)),
        })
      )
      continue
    }
    for (const keyId of keyIds) {
      const key = ctx.index.keys.get(keyId)
      findings.push(
        makeFinding(plan, {
          rule: 'L002',
          key: `${walletId}:${keyId}`,
          title: `Losing ${key?.label ?? 'a key'} makes ${wallet.label} unspendable`,
          detail: `${wallet.label} cannot reach a threshold on any path without ${key?.label ?? 'that key'}, even though other keys in the wallet are individually survivable.`,
          remediation: `Add redundancy behind ${key?.label ?? 'that key'}: a second backup at an independent location, or a spend path that does not require it.`,
          subjects: [
            { type: 'wallet', id: walletId },
            { type: 'key', id: keyId },
          ],
          severity: escalate('critical', walletWeight(wallet)),
        })
      )
    }
  }

  // --- devices --------------------------------------------------------------
  for (const device of plan.devices) {
    const scenario = objectLostScenario(ctx, 'device-lost', device.id, device.label)
    const hit = broken(ctx, scenario, live)
    if (hit.length === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'L003',
        key: device.id,
        title: `Losing ${device.label} makes ${names(hit.map((w) => w.label))} unspendable`,
        detail: `A device is the single object in this plan most likely to fail on its own: batteries, firmware, drops, water, and airport bins. Nothing written down covers for this one.`,
        remediation: `Write down the keys that live on ${device.label} and store the backup away from it.`,
        subjects: [
          { type: 'device', id: device.id },
          ...hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        ],
        world: scenario.label,
        scenarioId: scenario.id,
        severity: escalate('high', worst(hit)),
      })
    )
  }

  // --- backups --------------------------------------------------------------
  for (const key of plan.keys) {
    for (const backup of key.backups) {
      const scenario = objectLostScenario(
        ctx,
        'backup-lost',
        backup.id,
        `${key.label} / ${backup.label}`
      )
      const hit = broken(ctx, scenario, live)
      if (hit.length === 0) continue
      findings.push(
        makeFinding(plan, {
          rule: 'L004',
          key: backup.id,
          title: `Losing ${key.label} / ${backup.label} makes ${names(hit.map((w) => w.label))} unspendable`,
          detail:
            'Backups go missing quietly: a house move, a clear-out, a landlord, a relative tidying up. The absence is discovered at the moment it is needed.',
          remediation: `Make a second copy of ${key.label} and store it at an independent location, or check this one on a schedule so its absence is found early.`,
          subjects: [
            { type: 'key', id: key.id },
            { type: 'backup', id: backup.id },
            ...hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
          ],
          world: scenario.label,
          scenarioId: scenario.id,
          severity: escalate('high', worst(hit)),
        })
      )
    }
  }

  // --- wallet configuration -------------------------------------------------
  for (const wallet of live) {
    if (wallet.configBackups.length === 0) continue
    const fatal = wallet.configBackups.filter((backup) => {
      const scenario = objectLostScenario(ctx, 'config-lost', backup.id, backup.label)
      return !evaluateWallet(plan, wallet, scenario.world).spendable
    })
    if (fatal.length === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'L008',
        key: wallet.id,
        title: `${wallet.label} has only one copy of its wallet configuration`,
        detail: `Losing ${names(fatal.map((backup) => backup.label))} leaves ${wallet.label} unrecoverable even with every seed intact. The descriptor is not derivable from the seeds alone.`,
        remediation: `Store a second copy of ${wallet.label}'s configuration at a location in a different disaster group. It holds no secret, so it can be kept more widely than a seed.`,
        subjects: [{ type: 'wallet', id: wallet.id }],
        severity: escalate('critical', walletWeight(wallet)),
      })
    )
  }

  // --- people ---------------------------------------------------------------
  for (const person of plan.people) {
    const scenario = personLostScenario(ctx, person.id)
    const hit = broken(ctx, scenario, live)
    if (hit.length === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'L006',
        key: person.id,
        title: `Losing ${person.label} makes ${names(hit.map((w) => w.label))} unspendable`,
        detail: `The plan depends on ${person.label} being reachable and willing. People move, fall out, lose capacity, and die, and none of those give notice.`,
        remediation: `Add a route to ${names(hit.map((w) => w.label))} that does not pass through ${person.label}.`,
        subjects: [
          { type: 'person', id: person.id },
          ...hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        ],
        world: scenario.label,
        scenarioId: scenario.id,
        severity: escalate('high', worst(hit)),
      })
    )
  }

  // --- how long it takes ----------------------------------------------------
  // A route that still works is not the same as a route you could live with.
  // This is the only rule that reads the stated tolerance against measured
  // time, which is what makes that number on the profile worth answering.
  for (const wallet of live) {
    const survivable = plan.locations
      .map((location) => locationLostScenario(ctx, location.id))
      .filter((scenario) => evaluateWallet(plan, wallet, scenario.world).spendable)
      .map((scenario) => ({ scenario, timing: recoveryTiming(plan, wallet, scenario.world) }))
    if (survivable.length === 0) continue

    const worstCase = survivable.reduce((slowest, entry) =>
      entry.timing.days > slowest.timing.days ? entry : slowest
    )
    const tolerance = plan.profile.recoveryToleranceDays
    if (worstCase.timing.days <= tolerance) continue

    findings.push(
      makeFinding(plan, {
        rule: 'L009',
        key: wallet.id,
        title: `Recovering ${wallet.label} takes ${describeDuration(worstCase.timing.days, worstCase.timing.travelMinutes)}`,
        detail: `${worstCase.scenario.label}, and ${wallet.label} still spends. Getting there means ${describeSteps(worstCase.timing)}: ${worstCase.timing.days} days against a stated tolerance of ${tolerance}. A route that works and takes that long is a route people abandon halfway, or never rehearse.${
          worstCase.timing.unknowns.length > 0
            ? ` It is also a floor rather than an estimate: ${worstCase.timing.unknowns
                .map((unknown) => unknown.note)
                .join(' ')}`
            : ''
        }`,
        remediation:
          tolerance === 0
            ? `Either put one usable route to ${wallet.label} within same-day reach, or record a tolerance you would actually accept. Zero days means every key has to be reachable this afternoon.`
            : `Move one of the places ${wallet.label} depends on closer, or add a route that does not need the far one. Failing that, raise the recorded tolerance to what you would really accept, so the rest of the plan is measured against a true number.`,
        subjects: [{ type: 'wallet', id: wallet.id }],
        world: worstCase.scenario.label,
        scenarioId: worstCase.scenario.id,
        severity: escalate('high', walletWeight(wallet)),
      })
    )
  }

  return findings
}
