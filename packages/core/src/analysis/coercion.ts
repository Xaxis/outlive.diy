/**
 * Coercion: what can be taken from you in an afternoon.
 *
 * This analysis assumes you cooperate, because that is what compulsion means
 * and because a plan that depends on your resistance is not a plan. The
 * question is arithmetic: how much key material exists within one trip of where
 * you are, with everything you remember available.
 *
 * Only three things change the answer. Distance, a delay, and another person.
 */

import type { Finding } from './findings.ts'
import { escalate, makeFinding, walletWeight } from './findings.ts'
import type { AnalysisContext } from './context.ts'
import { evaluateWallet } from './availability.ts'
import { coercionScenario } from './scenarios.ts'
import { keysetSpends } from './compromise.ts'
import { keyLocationIds } from '../model/selectors.ts'
import type { Wallet } from '../model/types.ts'

function names(items: readonly string[]): string {
  if (items.length === 0) return 'nothing'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function analyseCoercion(ctx: AnalysisContext): Finding[] {
  const { plan } = ctx
  const findings: Finding[] = []
  const real = plan.wallets.filter((wallet) => !wallet.decoy)
  if (real.length === 0) return findings

  const scenario = coercionScenario(ctx)
  const hours = Math.round(ctx.options.coercionTravelMinutes / 60)
  const hit: Wallet[] = real.filter(
    (wallet) => evaluateWallet(plan, wallet, scenario.world).spendable
  )

  if (hit.length > 0) {
    findings.push(
      makeFinding(plan, {
        rule: 'X001',
        key: `${ctx.options.coercionTravelMinutes}`,
        title: `${names(hit.map((w) => w.label))} can be emptied in a single ${hours}-hour session`,
        detail: `With you present and cooperating, everything needed to reach a threshold on ${names(hit.map((w) => w.label))} is within ${hours} hours of travel. Cooperating ends the event and so does refusing, which is the position this analysis exists to make visible before it happens.`,
        remediation:
          'Put a threshold-breaking key beyond one session: a location that takes longer to reach than an attacker will wait, a co-signer who must be contacted separately, or a separate tier whose only route is timelocked, holding the balance you could not replace. A tier rather than this wallet, because a wallet whose every route waits is a wallet you cannot move in an emergency either.',
        subjects: hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        world: scenario.label,
        scenarioId: scenario.id,
        severity: escalate('critical', Math.max(...hit.map(walletWeight))),
      })
    )
  }

  if (hit.length === real.length && real.length > 1) {
    findings.push(
      makeFinding(plan, {
        rule: 'X002',
        key: 'all',
        title: 'Every wallet is reachable under compulsion on the same day',
        detail: `All ${real.length} wallets fall to the same ${hours}-hour session. There is no tier of this plan that survives the others, so a single bad afternoon is total.`,
        remediation:
          'Build one tier that is structurally out of reach of a single session, and keep the balance you could not replace in it.',
        subjects: real.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        world: scenario.label,
        scenarioId: scenario.id,
      })
    )
  }

  // --- is there any friction at all? ----------------------------------------
  const hasTimelock = plan.wallets.some((wallet) =>
    wallet.paths.some((path) => path.timelockDays > 0)
  )
  const hasDistance = plan.locations.some(
    (location) =>
      location.travelMinutes !== null && location.travelMinutes > ctx.options.coercionTravelMinutes
  )
  const hasThirdParty = plan.keys.some((key) => key.heldBy !== null)
  if (!hasTimelock && !hasDistance && !hasThirdParty && plan.wallets.length > 0) {
    findings.push(
      makeFinding(plan, {
        rule: 'X003',
        key: 'no-friction',
        title: 'Nothing in this plan makes anyone wait',
        detail: `No spend path is timelocked, every location is within ${hours} hours, and no key is held by another person. There is no point at which an attacker, or you under pressure, has to stop and wait.`,
        remediation:
          'Introduce one source of delay and make something you care about depend on it. Distance, a timelock, or a second party; any one of the three.',
        subjects: [{ type: 'plan', id: plan.id }],
      })
    )
  }

  // --- material that crosses borders with you ---------------------------------
  //
  // The one situation where distance protects nothing, because the distance is
  // travelling with the material.
  if (plan.profile.travelsFrequently) {
    const carried = plan.locations.filter((location) => location.kind === 'on-person')
    const onPerson = plan.keys.filter((key) =>
      keyLocationIds(plan, key).some((id) => carried.some((location) => location.id === id))
    )
    if (onPerson.length > 0) {
      findings.push(
        makeFinding(plan, {
          rule: 'X005',
          key: 'travel',
          title: `${names(onPerson.map((key) => key.label))} ${onPerson.length === 1 ? 'travels' : 'travel'} with you`,
          detail:
            'You travel often and this material is carried. A border crossing is a place where you can be separated from a device and told to unlock it, with no lawyer, no clock and nobody obliged to explain. Everything the coercion analysis assumes is true there, and none of the distance in this plan applies.',
          remediation:
            'Carry nothing that is part of a threshold. If something must travel, make it a key the wallet can be spent without.',
          subjects: onPerson.map((key) => ({ type: 'key' as const, id: key.id })),
        })
      )
    }
  }

  // --- the decoy that gives away a real key -----------------------------------
  //
  // X004 tells people to build a decoy, and nothing used to look at the one
  // they built. A decoy is surrendered on purpose, so every key that opens it
  // is a key the plan has decided in advance to lose. Sharing one with a real
  // wallet turns the surrender from theatre into a handover.
  for (const decoy of plan.wallets.filter((wallet) => wallet.decoy)) {
    const decoyKeyIds = new Set(decoy.paths.flatMap((path) => path.keyIds))
    if (decoyKeyIds.size === 0) continue
    for (const wallet of real) {
      const shared = plan.keys.filter(
        (key) =>
          decoyKeyIds.has(key.id) && wallet.paths.some((path) => path.keyIds.includes(key.id))
      )
      if (shared.length === 0) continue
      const spends = keysetSpends(wallet, decoyKeyIds)
      const labels = names(shared.map((key) => key.label))
      findings.push(
        makeFinding(plan, {
          rule: 'X006',
          key: `${decoy.id}:${wallet.id}`,
          title: spends.yes
            ? `Handing over ${decoy.label} hands over ${wallet.label}`
            : `${decoy.label} is built from ${wallet.label}'s ${shared.length === 1 ? 'key' : 'keys'}`,
          detail: spends.yes
            ? `${decoy.label} is the wallet you intend to surrender, and the material that opens it reaches the threshold on ${wallet.label}'s ${spends.pathLabel}. Whoever you hand it to does not leave with a small balance and a story. They leave with ${wallet.label}.`
            : `${decoy.label} is the wallet you intend to surrender, and ${labels} also ${shared.length === 1 ? 'counts' : 'count'} toward ${wallet.label}. Surrendering the decoy means agreeing in advance to lose that material: they walk away holding part of a real threshold, and nothing tells you it now has to be replaced.`,
          remediation: `Generate ${decoy.label} from key material that appears nowhere else in this plan. A decoy is only worth having if losing it costs what it looks like it costs.`,
          subjects: [
            { type: 'wallet', id: decoy.id },
            { type: 'wallet', id: wallet.id },
            ...shared.map((key) => ({ type: 'key' as const, id: key.id })),
          ],
          severity: escalate(spends.yes ? 'critical' : 'high', walletWeight(wallet)),
        })
      )
    }
  }

  if (plan.profile.concerns.includes('coercion') && !plan.wallets.some((wallet) => wallet.decoy)) {
    findings.push(
      makeFinding(plan, {
        rule: 'X004',
        key: 'no-decoy',
        title: 'There is nothing plausible to hand over',
        detail:
          'Coercion is a stated concern and the plan has no decoy wallet. Having nothing to give is its own hazard: the demand does not end because the answer is no. A decoy is not free, either, and this is the one finding here whose remedy can make things worse: one that is not believed is worse than none, because being caught holding something back is the point at which a robbery stops being about money.',
        remediation:
          'Add a wallet you would be willing to lose, keep a real balance in it, and give it a history of ordinary use so that surrendering it is credible. If you would not find the amount credible coming from somebody else, do not build it.',
        subjects: [{ type: 'plan', id: plan.id }],
      })
    )
  }

  return findings
}
