/**
 * Succession: can the people who outlive you reach the coins, and only then.
 *
 * Both halves are failures. A successor who cannot act loses everything. A
 * successor who can act today is not an heir, they are a co-owner you have not
 * agreed to become. Most inheritance advice covers the first and quietly
 * creates the second.
 */

import type { Finding } from './findings.ts'
import { escalate, makeFinding, walletWeight } from './findings.ts'
import type { AnalysisContext } from './context.ts'
import { evaluateWallet } from './availability.ts'
import { personCompromisedScenario, userDeathScenario } from './scenarios.ts'
import { baseWorld } from './availability.ts'
import { isMultisig, keyLocationIds, locationsReachableBy } from '../model/selectors.ts'
import type { Person, Plan, TechnicalSkill } from '../model/types.ts'

const SKILL_ORDER: TechnicalSkill[] = ['none', 'basic', 'competent', 'expert']

function names(items: readonly string[]): string {
  if (items.length === 0) return 'nothing'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function heirs(plan: Plan): Person[] {
  return plan.people.filter((person) => person.role === 'successor' || person.role === 'executor')
}

/**
 * How hard the recovery actually is, as a floor on what the successor has to be
 * able to do. Written as the highest bar any wallet imposes, because they will
 * meet the hardest one first and give up there.
 */
export function requiredSkill(plan: Plan): { skill: TechnicalSkill; because: string } {
  let skill: TechnicalSkill = 'basic'
  let because = 'restore a seed backup into a wallet and send a transaction'
  const raise = (next: TechnicalSkill, why: string) => {
    if (SKILL_ORDER.indexOf(next) > SKILL_ORDER.indexOf(skill)) {
      skill = next
      because = why
    }
  }
  if (plan.wallets.some((wallet) => isMultisig(wallet))) {
    raise('competent', 'rebuild a multisig wallet from a descriptor and co-sign across devices')
  }
  if (plan.keys.some((key) => key.passphrase.enabled)) {
    raise(
      'competent',
      'apply a passphrase correctly, and know that a wrong one looks like an empty wallet'
    )
  }
  if (plan.keys.some((key) => key.backups.some((backup) => backup.split !== null))) {
    raise('expert', 'reassemble a split secret from its shares')
  }
  if (plan.devices.some((device) => device.airGapped)) {
    raise('competent', 'move an unsigned transaction to an air-gapped signer and back')
  }
  return { skill, because }
}

export interface SuccessionBrief {
  /** What a successor has to be told for the plan to work. No secrets here. */
  mustKnow: string[]
  /** What telling them would hand them the coins today. */
  mustNotLearn: string[]
  /** True when the two lists cannot both be honoured as the plan stands. */
  overlaps: boolean
}

/**
 * The gap between what the successor needs and what they must not have.
 *
 * Computed rather than asserted: the model builds the world in which they know
 * every location the plan would have to name, and asks whether that alone lets
 * them spend today.
 */
export function successionBrief(ctx: AnalysisContext, person: Person): SuccessionBrief {
  const { plan } = ctx
  const materialLocations = new Set(plan.keys.flatMap((key) => keyLocationIds(plan, key)))
  const told = baseWorld(plan, {
    label: `${person.label}, told everything`,
    actor: 'adversary',
    reachable: materialLocations,
    unknownPlacementReachable: false,
    memory: false,
    cooperating: [person.id],
    elapsedDays: 0,
  })
  const overlaps = plan.wallets.some(
    (wallet) => !wallet.decoy && evaluateWallet(plan, wallet, told).spendable
  )

  const mustKnow: string[] = [
    'that a custody plan exists at all, and that coins are held under it',
    'where the written instructions are kept',
    'that no seed word, passphrase or private key is ever to be typed into a phone, a computer, a search box or a chat window',
  ]
  if (plan.wallets.some((wallet) => isMultisig(wallet))) {
    mustKnow.push(
      'that the wallet configuration is as necessary as the keys, and where a copy of it is'
    )
  }
  if (plan.keys.some((key) => key.passphrase.enabled)) {
    mustKnow.push('that a passphrase exists, so that an empty wallet is not mistaken for a theft')
  }
  const delayed = plan.locations.filter((location) =>
    location.access.some((access) => access.condition === 'after-death' && access.delayDays > 0)
  )
  if (delayed.length > 0) {
    mustKnow.push(
      'that some access only opens after a legal delay, so an early failure is expected'
    )
  }

  const mustNotLearn: string[] = []
  if (overlaps) {
    mustNotLearn.push(
      'the full set of locations holding key material, which together is enough to spend today'
    )
  }
  mustNotLearn.push('any passphrase or device PIN, while you are alive to use them')

  return { mustKnow, mustNotLearn, overlaps }
}

export function analyseSuccession(ctx: AnalysisContext): Finding[] {
  const { plan } = ctx
  const findings: Finding[] = []
  const successors = heirs(plan)
  const real = plan.wallets.filter((wallet) => !wallet.decoy)
  if (real.length === 0) return findings

  // --- can anybody act at all? ---------------------------------------------
  const death = userDeathScenario(ctx, null)
  const unreachable = real.filter((wallet) => !evaluateWallet(plan, wallet, death.world).spendable)
  if (unreachable.length > 0 && successors.length > 0) {
    findings.push(
      makeFinding(plan, {
        rule: 'U001',
        key: 'all',
        title: `Nobody can reach ${names(unreachable.map((w) => w.label))} after your death`,
        detail: `With every successor acting together, and after the delays the plan records, ${names(unreachable.map((w) => w.label))} still cannot be spent. ${
          plan.keys.some((key) => key.passphrase.enabled && key.passphrase.storage === 'memorized')
            ? 'A memorised passphrase is part of this: it does not survive you.'
            : 'The key material they can reach does not add up to a threshold.'
        }`,
        remediation:
          'Give a successor after-death access to one more location, or add a timelocked inheritance path that opens on its own.',
        subjects: unreachable.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        world: death.label,
        severity: escalate('critical', Math.max(0, ...unreachable.map(walletWeight))),
      })
    )
  }

  for (const person of successors) {
    // --- can they act today, which is the other failure --------------------
    const now = personCompromisedScenario(ctx, person.id)
    const live = real.filter((wallet) => evaluateWallet(plan, wallet, now.world).spendable)
    if (live.length > 0) {
      findings.push(
        makeFinding(plan, {
          rule: 'U002',
          key: person.id,
          title: `${person.label} can already spend ${names(live.map((w) => w.label))}`,
          detail: `${person.label} is described as a successor, and the access they hold works today, without you and without notice. That is not inheritance; it is a shared wallet with one signature.`,
          remediation: `Make ${person.label}'s access conditional: a sealed instruction they cannot open unobserved, a location whose access is only granted after death, or a timelocked path that gives them the same power later and none of it now.`,
          subjects: [
            { type: 'person', id: person.id },
            ...live.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
          ],
          world: now.label,
          severity: escalate('critical', Math.max(0, ...live.map(walletWeight))),
        })
      )
    }

    if (!person.knowsPlanExists) {
      findings.push(
        makeFinding(plan, {
          rule: 'U003',
          key: person.id,
          title: `${person.label} does not know this plan exists`,
          detail:
            'Every route below assumes somebody starts walking it. Nobody starts a route they have not been told about, and coins do not appear in an estate inventory on their own.',
          remediation: `Tell ${person.label} that a plan exists and that instructions are kept somewhere they will be given. That sentence contains no secret.`,
          subjects: [{ type: 'person', id: person.id }],
        })
      )
    } else if (!person.knowsWhereInstructionsAre) {
      findings.push(
        makeFinding(plan, {
          rule: 'U004',
          key: person.id,
          title: `${person.label} does not know where the instructions are`,
          detail:
            'They know something exists and not where to begin. The first step of every recovery route is finding the paper.',
          remediation: `Tell ${person.label} exactly where the instruction envelope is, or lodge it with a professional and tell them who to ask.`,
          subjects: [{ type: 'person', id: person.id }],
        })
      )
    }

    const required = requiredSkill(plan)
    if (SKILL_ORDER.indexOf(person.technicalSkill) < SKILL_ORDER.indexOf(required.skill)) {
      findings.push(
        makeFinding(plan, {
          rule: 'U005',
          key: person.id,
          title: `${person.label} would have to ${required.because}`,
          detail: `The recovery this plan demands needs someone ${required.skill}; ${person.label} is recorded as ${person.technicalSkill}. They will be attempting it for the first time, under grief, with no way to ask you what you meant.`,
          remediation: `Either write the recovery route out to a level ${person.label} can follow without judgement calls, name a technical helper they are told to contact, or simplify the policy until the route matches the person.`,
          subjects: [{ type: 'person', id: person.id }],
        })
      )
    }

    const delays = locationsReachableBy(plan, person.id, 'after-death').map(
      (entry) => entry.delayDays
    )
    const worstDelay = delays.length ? Math.max(...delays) : 0
    if (worstDelay > plan.profile.recoveryToleranceDays) {
      findings.push(
        makeFinding(plan, {
          rule: 'U006',
          key: person.id,
          title: `${person.label} waits ${worstDelay} days before they can act`,
          detail: `The access ${person.label} needs opens after ${worstDelay} days, against a stated tolerance of ${plan.profile.recoveryToleranceDays}. That is real time during which the estate is frozen and nobody can do anything about it.`,
          remediation:
            'Give one location an access route that does not wait on probate: a sealed envelope with a named holder, a joint arrangement, or a timelocked path in the wallet policy itself.',
          subjects: [{ type: 'person', id: person.id }],
        })
      )
    }

    if (person.availability === 'unknown') {
      findings.push(
        makeFinding(plan, {
          rule: 'U008',
          key: person.id,
          title: `Nobody has confirmed ${person.label} could be reached`,
          detail: `${person.label} is the route, and how quickly they could act is recorded as not known. On the day it matters, that is not a detail missing from the plan; it is the plan.`,
          remediation: `Ask ${person.label} directly, and record what they said. If the answer is that they could not act quickly, that is worth knowing now rather than then.`,
          subjects: [{ type: 'person', id: person.id }],
        })
      )
    }

    const brief = successionBrief(ctx, person)
    if (brief.overlaps && live.length === 0) {
      findings.push(
        makeFinding(plan, {
          rule: 'U007',
          key: person.id,
          title: `What ${person.label} must be told is enough to spend today`,
          detail: `To act after your death, ${person.label} has to be told where the key material is. Knowing all of it is, by itself, enough to reach a threshold now. The plan therefore cannot both prepare them and stay closed, as it stands.`,
          remediation:
            'Split the knowledge in time rather than in content: seal the location list so that opening it is observable, lodge it with a professional released on a death certificate, or add a passphrase held only by a third party.',
          subjects: [{ type: 'person', id: person.id }],
        })
      )
    }
  }

  return findings
}
