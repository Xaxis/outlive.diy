/**
 * What the answers on the purpose page mean for the plan underneath them.
 *
 * The four questions there used to be number fields with a sentence of help
 * text: type 30, type 40, type 1, and nothing happens. A question whose answer
 * changes nothing the reader can see is a question they answer carelessly, and
 * a careless answer is worse than none, because the rest of the analysis then
 * measures against it.
 *
 * So each answer is paired with the thing in the plan it actually governs, and
 * that pairing is computed rather than asserted. "Thirty years" is measured
 * against the media the keys are written on. "Within a day" is measured against
 * how long the slowest surviving recovery really takes. Where there is nothing
 * yet to measure it says so, rather than reporting agreement it has not earned.
 */

import type { Backup, Plan } from '../model/types.ts'
import { disasterGroups } from '../model/selectors.ts'
import { baseWorld, evaluateWallet } from './availability.ts'
import { locationLostScenario } from './scenarios.ts'
import { createContext } from './context.ts'
import { describeDuration, recoveryTiming } from './timing.ts'

export type ImplicationId = 'concerns' | 'tolerance' | 'horizon' | 'jurisdiction' | 'travel'

export interface Implication {
  id: ImplicationId
  /** The question, so the panel reads as a conversation rather than a report. */
  question: string
  /** What the user answered, in their words rather than as a number. */
  said: string
  /** What the plan as it stands does about it. Measured, never asserted. */
  measured: string
  /**
   * Whether the plan meets the answer. Null when there is not enough described
   * yet to say, which is a different thing from meeting it.
   */
  meets: boolean | null
}

/** How long each medium is worth planning around, in years. */
const MEDIUM_YEARS: Record<Backup['medium'], number> = {
  steel: 100,
  paper: 15,
  'encrypted-digital': 10,
  'plain-digital': 10,
  // A memorised secret does not outlive the person holding it, and the horizon
  // question is about exactly the period after that.
  memorized: 0,
}

const MEDIUM_NAME: Record<Backup['medium'], string> = {
  steel: 'steel',
  paper: 'paper',
  'encrypted-digital': 'an encrypted file',
  'plain-digital': 'a plain file',
  memorized: 'memory',
}

export function describeTolerance(days: number): string {
  if (days <= 0) return 'the same day'
  if (days === 1) return 'within a day'
  if (days <= 7) return `within ${days} days`
  if (days <= 31) return `within about a month`
  if (days <= 120) return 'within a few months'
  return 'it would not be urgent'
}

export function describeHorizon(years: number): string {
  if (years <= 5) return `${years} years, with you maintaining it`
  if (years >= 50) return `${years} years, well past your own life`
  return `${years} years`
}

export function profileImplications(plan: Plan): Implication[] {
  const out: Implication[] = []
  const profile = plan.profile

  out.push({
    id: 'concerns',
    question: 'What are you planning against?',
    said: profile.concerns.length === 0 ? 'nothing named yet' : `${profile.concerns.length} named`,
    measured:
      profile.concerns.length === 0
        ? 'Every rule still runs. Naming a concern only moves its findings to the top of the list, so an unnamed one is not a risk that has gone away.'
        : 'Every rule still runs. These move their findings to the top of the list, and change nothing else.',
    meets: null,
  })

  // --- tolerance, against how long a recovery really takes -------------------
  const live = plan.wallets.filter(
    (wallet) => evaluateWallet(plan, wallet, baseWorld(plan)).spendable
  )
  if (live.length === 0 || plan.locations.length === 0) {
    out.push({
      id: 'tolerance',
      question: 'How long could you go without being able to move coins?',
      said: describeTolerance(profile.recoveryToleranceDays),
      measured:
        'Nothing to measure this against yet. Once there is a wallet that can be spent, this is compared against how long the slowest surviving recovery actually takes.',
      meets: null,
    })
  } else {
    const ctx = createContext(plan)
    let worstDays = 0
    let worstText = 'no travel and no waiting'
    let worstWhere = ''
    for (const wallet of live) {
      for (const location of plan.locations) {
        const scenario = locationLostScenario(ctx, location.id)
        if (!evaluateWallet(plan, wallet, scenario.world).spendable) continue
        const timing = recoveryTiming(plan, wallet, scenario.world)
        if (timing.days < worstDays) continue
        worstDays = timing.days
        worstText = describeDuration(timing.days, timing.travelMinutes)
        worstWhere = `${wallet.label} after losing ${location.label}`
      }
    }
    out.push({
      id: 'tolerance',
      question: 'How long could you go without being able to move coins?',
      said: describeTolerance(profile.recoveryToleranceDays),
      measured: worstWhere
        ? `The slowest recovery that still works takes ${worstText}: ${worstWhere}.`
        : 'No single place can be lost without ending every wallet, so there is no surviving recovery to time. That is a larger problem than the tolerance.',
      meets: worstWhere ? worstDays <= profile.recoveryToleranceDays : false,
    })
  }

  // --- horizon, against what the keys are written on -------------------------
  const backups = plan.keys.flatMap((key) => key.backups)
  if (backups.length === 0) {
    out.push({
      id: 'horizon',
      question: 'How long does this have to keep working without you?',
      said: describeHorizon(profile.horizonYears),
      measured:
        'Nothing to measure this against yet. Once a key has something written down, this is compared against how long that medium lasts.',
      meets: null,
    })
  } else {
    // The plan lasts as long as its best copy of its weakest key, so this is a
    // maximum inside each key and a minimum across them.
    let weakest = Infinity
    let weakestMedium: Backup['medium'] = 'steel'
    let weakestKey = ''
    for (const key of plan.keys) {
      if (key.backups.length === 0) continue
      let best = 0
      let bestMedium: Backup['medium'] = 'memorized'
      for (const backup of key.backups) {
        if (MEDIUM_YEARS[backup.medium] <= best) continue
        best = MEDIUM_YEARS[backup.medium]
        bestMedium = backup.medium
      }
      if (best >= weakest) continue
      weakest = best
      weakestMedium = bestMedium
      weakestKey = key.label
    }
    out.push({
      id: 'horizon',
      question: 'How long does this have to keep working without you?',
      said: describeHorizon(profile.horizonYears),
      measured:
        weakest === 0
          ? `${weakestKey} exists only in memory, which does not survive you at all.`
          : weakest >= profile.horizonYears
            ? `Every key has a copy on a medium worth planning around for at least ${weakest} years.`
            : `The longest-lived copy of ${weakestKey} is on ${MEDIUM_NAME[weakestMedium]}, which is worth planning around for about ${weakest} years. That is the number the whole plan is limited by.`,
      meets: weakest >= profile.horizonYears,
    })
  }

  // --- jurisdiction, against the places actually recorded --------------------
  const groups = disasterGroups(plan)
  const places =
    plan.locations.length === 1
      ? 'The one place you have recorded is'
      : `All ${plan.locations.length} of the places you have recorded are`
  const spread = `${groups.size || 1} ${groups.size === 1 ? 'disaster group' : 'disaster groups'}`
  out.push({
    id: 'jurisdiction',
    question: 'How many legal systems does this plan sit in?',
    said: profile.jurisdictionCount === 1 ? 'one' : `${profile.jurisdictionCount}`,
    measured:
      plan.locations.length === 0
        ? 'Nothing to measure this against yet.'
        : profile.jurisdictionCount === 1
          ? `${places} inside it, across ${spread}. One order reaches every one of them, however far apart they are.`
          : `${places} spread across ${spread}. The plan does not record which place is in which jurisdiction, so nothing here checks that the split is real.`,
    // A single jurisdiction is a fact, not a failure, and grading it as one
    // would be this program having an opinion about where somebody lives. It
    // only falls short of the answer when seizure is a concern they named.
    meets:
      plan.locations.length === 0
        ? null
        : profile.concerns.includes('legal-seizure')
          ? profile.jurisdictionCount > 1
          : null,
  })

  // --- travel ----------------------------------------------------------------
  const far = plan.locations.filter(
    (location) => location.travelMinutes !== null && location.travelMinutes > 240
  )
  out.push({
    id: 'travel',
    question: 'Are you away from home often?',
    said: profile.travelsFrequently ? 'yes, regularly' : 'no, usually at home',
    measured: profile.travelsFrequently
      ? far.length > 0
        ? `${far.length} of your places ${far.length === 1 ? 'is' : 'are'} more than four hours away even when you are home. Away, every one of them is.`
        : 'Every place you have recorded is close to home, which is only true when you are at home.'
      : 'Distances are measured from home, and this says that is where you usually are.',
    meets: null,
  })

  return out
}
