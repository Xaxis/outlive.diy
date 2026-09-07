/**
 * Findings: what the engine says, and the rules it says it under.
 *
 * There is no score and no grade. A number would be read as a target, and the
 * only honest summary of a custody plan is the list of the ways it breaks, in
 * the order they should be dealt with. Flattery is a failure mode here: a
 * planner that congratulates a setup it has not stress-tested is worse than no
 * planner, because it will be believed.
 */

import type { Concern, Plan, Ref, Wallet } from '../model/types.ts'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type FindingCategory =
  'structure' | 'loss' | 'compromise' | 'correlation' | 'coercion' | 'succession' | 'staleness'

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export const CATEGORY_ORDER: FindingCategory[] = [
  'structure',
  'loss',
  'compromise',
  'coercion',
  'succession',
  'correlation',
  'staleness',
]

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  structure: 'Structure',
  loss: 'Loss',
  compromise: 'Compromise',
  correlation: 'Correlation',
  coercion: 'Coercion',
  succession: 'Succession',
  staleness: 'Staleness',
}

/**
 * What each category is really asking. Shown beside the findings, because a
 * category name alone reads as jargon and the question does not.
 */
export const CATEGORY_QUESTION: Record<FindingCategory, string> = {
  structure: 'Does the plan describe something that can work at all?',
  loss: 'Remove one thing. Can the coins still be moved?',
  compromise: 'Take one thing. Can an attacker move them?',
  correlation: 'Which independent-looking failures are actually one failure?',
  coercion: 'What can be taken from you in an afternoon, with your cooperation?',
  succession: 'Can the people who outlive you reach the coins, and only then?',
  staleness: 'What is believed rather than tested?',
}

/** The concern each category speaks to, used for ordering and nothing else. */
const CATEGORY_CONCERN: Record<FindingCategory, Concern[]> = {
  structure: ['loss'],
  loss: ['loss', 'fire-flood'],
  compromise: ['theft', 'insider', 'legal-seizure'],
  correlation: ['loss', 'fire-flood', 'supply-chain'],
  coercion: ['coercion'],
  succession: ['death', 'incapacity'],
  staleness: ['loss'],
}

export interface Finding {
  /** Stable across runs so the UI can keep a row expanded while the plan changes. */
  id: string
  rule: RuleId
  category: FindingCategory
  severity: Severity
  /** One line. What is true. */
  title: string
  /** The concrete facts behind it, in the user's own labels. */
  detail: string
  /** One action. Not a menu. */
  remediation: string
  subjects: Ref[]
  /** The simulated world this came out of, when it came out of one. */
  world?: string
  /** Whether the user named this concern. Orders within a severity, never hides. */
  relevance: 'primary' | 'secondary'
}

// --- The rule catalogue -----------------------------------------------------
// Every finding the engine can emit is registered here. The UI renders this
// list as documentation, so a rule that exists is a rule the user can read
// before it fires.

export type RuleId =
  // structure
  | 'S001'
  | 'S002'
  | 'S003'
  | 'S004'
  | 'S005'
  | 'S006'
  | 'S007'
  | 'S008'
  | 'S009'
  | 'S010'
  | 'S011'
  | 'S012'
  | 'S013'
  | 'S014'
  | 'S015'
  | 'S016'
  | 'S017'
  | 'S018'
  | 'S019'
  | 'S020'
  | 'S021'
  | 'S022'
  | 'S023'
  // loss
  | 'L001'
  | 'L002'
  | 'L003'
  | 'L004'
  | 'L005'
  | 'L006'
  | 'L007'
  | 'L008'
  // compromise
  | 'C001'
  | 'C002'
  | 'C003'
  | 'C004'
  | 'C005'
  | 'C006'
  | 'C007'
  // correlation
  | 'R001'
  | 'R002'
  | 'R003'
  | 'R004'
  | 'R005'
  | 'R006'
  // coercion
  | 'X001'
  | 'X002'
  | 'X003'
  | 'X004'
  | 'X005'
  // succession
  | 'U001'
  | 'U002'
  | 'U003'
  | 'U004'
  | 'U005'
  | 'U006'
  | 'U007'
  | 'U008'
  // staleness
  | 'T001'
  | 'T002'
  | 'T003'
  | 'T004'
  | 'T005'
  | 'T006'

export interface Rule {
  id: RuleId
  category: FindingCategory
  /** What the rule looks for, in one line. */
  looksFor: string
  /** Why it matters, for the reader who wants to argue with the rule. */
  because: string
  baseSeverity: Severity
}

function rule(
  id: RuleId,
  category: FindingCategory,
  baseSeverity: Severity,
  looksFor: string,
  because: string
): Rule {
  return { id, category, baseSeverity, looksFor, because }
}

export const RULES: Record<RuleId, Rule> = Object.fromEntries(
  (
    [
      rule(
        'S001',
        'structure',
        'critical',
        'A wallet with no way to spend',
        'A wallet with no spend path is a description of coins nobody can move.'
      ),
      rule(
        'S002',
        'structure',
        'critical',
        'A threshold higher than the number of keys',
        'An m-of-n where m exceeds n can never be satisfied by anybody, including you.'
      ),
      rule(
        'S003',
        'structure',
        'high',
        'A spend path with no keys',
        'The path is decoration until keys are assigned to it.'
      ),
      rule(
        'S004',
        'structure',
        'medium',
        'A vault-tier wallet on a single key',
        'Single signature concentrates loss and theft into the same object. That is a choice, not a mistake, but it should be a made one.'
      ),
      rule(
        'S005',
        'structure',
        'critical',
        'A key with neither a device nor a backup',
        'Nothing in the plan can produce this signature.'
      ),
      rule(
        'S006',
        'structure',
        'high',
        'A key that exists only on a device',
        'Devices fail, are lost, and are bricked by firmware. A key with no written backup is a key with a hardware-shaped expiry date.'
      ),
      rule(
        'S007',
        'structure',
        'medium',
        'A paper backup for a vault-tier key',
        'Paper loses to fire, water and time, which are the three things a vault is meant to survive.'
      ),
      rule(
        'S008',
        'structure',
        'high',
        'An unencrypted digital backup',
        'A file is copied silently and travels further than you will ever know.'
      ),
      rule(
        'S009',
        'structure',
        'low',
        'Key material with no recorded location',
        'Anything without a place is excluded from the location analysis, so the report below is incomplete by exactly that much.'
      ),
      rule(
        'S010',
        'structure',
        'critical',
        'A multisig wallet with no configuration backup',
        'The threshold of seeds is not enough. Without the descriptor there is no wallet to restore them into, and this is the single most common way a well-built multisig becomes unrecoverable.'
      ),
      rule(
        'S011',
        'structure',
        'critical',
        'A split backup with fewer shares than its threshold',
        'The secret has already been destroyed; the shares just have not been asked yet.'
      ),
      rule(
        'S012',
        'structure',
        'critical',
        'One device signing for more than one key in a path',
        'The quorum is theatre. One device seized or failed takes every key it holds, so the path is really 1-of-1 wearing an m-of-n costume.'
      ),
      rule(
        'S013',
        'structure',
        'high',
        'A memorised passphrase with no other route to the coins',
        'A memory is a single copy stored in an organ with no redundancy and a known failure rate.'
      ),
      rule(
        'S014',
        'structure',
        'high',
        'A passphrase written where the seed is kept',
        'Whoever opens that container has both halves. The passphrase is doing nothing except making recovery harder for you.'
      ),
      rule(
        'S015',
        'structure',
        'high',
        'Death is a stated concern but no successor exists',
        'Nobody is described who could act. That is a plan that ends when you do.'
      ),
      rule(
        'S016',
        'structure',
        'medium',
        'A hot wallet carrying a large share',
        'A key on a networked device is exposed to everything that device is exposed to.'
      ),
      rule(
        'S017',
        'structure',
        'low',
        'A co-signer with no key',
        'The role is recorded but the person signs nothing, so the plan does not depend on them the way it reads as if it does.'
      ),
      rule(
        'S018',
        'structure',
        'info',
        'A location with no disaster group',
        'Correlated destruction cannot be reasoned about for that place, so it is silently assumed independent.'
      ),
      rule(
        'S019',
        'structure',
        'medium',
        'A device PIN written down beside the device',
        'The PIN is the only thing standing between a thief and the key. Kept together, it stands nowhere.'
      ),
      rule(
        'S020',
        'structure',
        'medium',
        'A wallet whose only spend path is timelocked',
        'There is no way to move the coins until the lock elapses, including in an emergency.'
      ),

      rule(
        'S021',
        'structure',
        'medium',
        'A backup on a medium unlikely to outlast the plan',
        'Paper browns, fades, gets damp and gets thrown out in a clear-out. A file needs a format, a device and somebody who remembers it exists. Either is a poor bet across decades, and the horizon you gave is decades.'
      ),
      rule(
        'S022',
        'structure',
        'medium',
        'A plan that has to outlive a company',
        'Over the horizon you gave, a business is acquired, changes its terms, is compelled, or simply stops answering. None of those arrive with notice, and a key you cannot reach without them is a key somebody else controls.'
      ),
      rule(
        'S023',
        'structure',
        'high',
        'One key spending both a hot wallet and a vault',
        'A hot key lives on a machine that opens email and runs whatever it was told to. Reusing it in the vault hands the vault that exposure for one of its keys, and an attacker who takes the easy one is then a single key from the hard one.'
      ),
      rule(
        'L001',
        'loss',
        'critical',
        'One location lost and a wallet becomes unspendable',
        'Fire, flood, theft and eviction all take a whole place at once.'
      ),
      rule(
        'L002',
        'loss',
        'critical',
        'One key lost and a wallet becomes unspendable',
        'A threshold with no spare is a threshold you are already at.'
      ),
      rule(
        'L003',
        'loss',
        'high',
        'One device lost and a wallet becomes unspendable',
        'A device is the most likely single object to fail.'
      ),
      rule(
        'L004',
        'loss',
        'high',
        'One backup lost and a wallet becomes unspendable',
        'Backups are lost quietly and discovered missing at the worst moment.'
      ),
      rule(
        'L005',
        'loss',
        'critical',
        'One disaster group lost and a wallet becomes unspendable',
        'Places in one group fail on the same day, so this is a single event.'
      ),
      rule(
        'L006',
        'loss',
        'high',
        'One person unavailable and a wallet becomes unspendable',
        'People move, fall out, die and stop answering.'
      ),
      rule(
        'L007',
        'loss',
        'medium',
        'A wallet with no spare keys beyond its threshold',
        'It works today and cannot absorb anything.'
      ),
      rule(
        'L008',
        'loss',
        'critical',
        'The wallet configuration is a single point of failure',
        'Every seed survives and the wallet still does not.'
      ),

      rule(
        'C001',
        'compromise',
        'critical',
        'One location holds enough to spend',
        'Whoever opens that container owns the wallet. A written backup is a key; a locked device is not, until the attacker also has you.'
      ),
      rule(
        'C002',
        'compromise',
        'critical',
        'One person can reach enough to spend',
        'Access granted for recovery is access available for theft, every day, silently.'
      ),
      rule(
        'C003',
        'compromise',
        'high',
        'One vendor failure yields enough to spend',
        'A backdoor, a weak random number generator or a supply-chain substitution hits every unit at once.'
      ),
      rule(
        'C004',
        'compromise',
        'high',
        'Key material exists in unencrypted digital form',
        'That file is reachable by anything that has ever run on that machine.'
      ),
      rule(
        'C005',
        'compromise',
        'medium',
        'An unlocked device sits where others can reach it',
        'No PIN means possession is sufficient.'
      ),
      rule(
        'C006',
        'compromise',
        'high',
        'The passphrase sits with the quorum it protects',
        'It adds a step for you and nothing for an attacker who is already in the room.'
      ),

      rule(
        'C007',
        'compromise',
        'medium',
        'A wallet configuration where somebody else can read it',
        'The descriptor cannot spend, which is why it is safe to copy, and it can be watched. Whoever holds one sees every address the wallet will ever use and every balance it has ever held, permanently and without asking again.'
      ),
      rule(
        'R001',
        'correlation',
        'high',
        'A quorum of keys behind one vendor',
        'Two devices from one maker are one decision, one firmware lineage and one bad day.'
      ),
      rule(
        'R002',
        'correlation',
        'medium',
        'A quorum of keys on one hardware architecture',
        'Shared silicon crosses brand boundaries, so different logos can still be one failure.'
      ),
      rule(
        'R003',
        'correlation',
        'critical',
        'A quorum concentrated in one disaster group',
        'Geographic separation that shares a flood plain is not separation.'
      ),
      rule(
        'R004',
        'correlation',
        'high',
        'One person can reach a quorum of backups',
        'The threshold exists to require more than one decision. This makes it one.'
      ),
      rule(
        'R005',
        'correlation',
        'low',
        'Every device from one supply route',
        'Second-hand and reseller stock share an interception surface.'
      ),

      rule(
        'R006',
        'correlation',
        'high',
        'Everything inside one legal system',
        'A seizure order, a change of law and a frozen estate apply to every container in a jurisdiction at once, however far apart the buildings are. Geography is not the only kind of distance.'
      ),
      rule(
        'X001',
        'coercion',
        'critical',
        'A quorum reachable in one trip, with you cooperating',
        'This is the number that matters in a robbery. If it meets the threshold, cooperating ends the event and so does refusing.'
      ),
      rule(
        'X002',
        'coercion',
        'high',
        'Every wallet can be opened under compulsion today',
        'Nothing in the plan buys time or forces a second location.'
      ),
      rule(
        'X003',
        'coercion',
        'medium',
        'Nothing in the plan imposes a delay',
        'No timelock, no distant site, no second party. There is no point at which an attacker has to wait.'
      ),
      rule(
        'X004',
        'coercion',
        'low',
        'No decoy wallet exists',
        'Under compulsion, having nothing plausible to hand over is its own problem.'
      ),

      rule(
        'X005',
        'coercion',
        'high',
        'Key material that travels with you',
        'A border is a place where you can be separated from a device and told to unlock it, with no lawyer, no clock and no obligation on anybody to explain. Carrying it is the one situation where distance protects nothing.'
      ),
      rule(
        'U001',
        'succession',
        'critical',
        'No successor can reach the coins after your death',
        'The coins are gone in every sense that matters, and nobody will know why.'
      ),
      rule(
        'U002',
        'succession',
        'critical',
        'A successor could spend today, without you',
        'Inheritance access that is live now is not inheritance, it is a shared wallet you have not agreed to.'
      ),
      rule(
        'U003',
        'succession',
        'high',
        'A successor does not know the plan exists',
        'A perfect recovery route nobody is told about is not a route.'
      ),
      rule(
        'U004',
        'succession',
        'high',
        'A successor does not know where the instructions are',
        'The first step of every recovery is finding the paper, and that step is missing.'
      ),
      rule(
        'U005',
        'succession',
        'medium',
        'The recovery demands more skill than the successor has',
        'A procedure written for you is not a procedure for them.'
      ),
      rule(
        'U006',
        'succession',
        'high',
        'Inheritance access arrives later than the plan tolerates',
        'Probate delay is real time during which nobody can act.'
      ),
      rule(
        'U007',
        'succession',
        'medium',
        'The successor must be told something that must stay secret',
        'What they need to act and what they must never learn overlap, and that overlap has to be resolved deliberately.'
      ),

      rule(
        'U008',
        'succession',
        'medium',
        'A successor nobody has confirmed can be reached',
        'The whole route depends on somebody answering. Not knowing whether they would is not a small gap in the plan; on the day it matters it is the plan.'
      ),
      rule(
        'T001',
        'staleness',
        'medium',
        'A verification is overdue',
        'The claim it stood for has quietly become an assumption again.'
      ),
      rule(
        'T002',
        'staleness',
        'high',
        'A backup has never been restored',
        'An unread backup is a belief about a piece of metal.'
      ),
      rule(
        'T003',
        'staleness',
        'medium',
        'A wallet has never been spend-tested',
        'The first real spend should not be the one that matters.'
      ),
      rule(
        'T004',
        'staleness',
        'medium',
        'The succession route has never been rehearsed',
        'Every step you did not watch someone else take is a step you are guessing about.'
      ),
      rule(
        'T005',
        'staleness',
        'low',
        'A device has not been checked in a long time',
        'Firmware, batteries and corrosion all move while nothing is happening.'
      ),
      rule(
        'T006',
        'staleness',
        'high',
        'Nothing in this plan has been verified at all',
        'Everything below is a description of intentions.'
      ),
    ] as Rule[]
  ).map((entry) => [entry.id, entry])
) as Record<RuleId, Rule>

// --- Building findings ------------------------------------------------------

export function escalate(severity: Severity, steps: number): Severity {
  const index = SEVERITY_ORDER.indexOf(severity)
  const next = Math.min(Math.max(index - steps, 0), SEVERITY_ORDER.length - 1)
  return SEVERITY_ORDER[next]
}

/**
 * How much a wallet's own weight moves a finding about it. A vault holding most
 * of the stack earns a step; a hot wallet with pocket money gives one back.
 */
export function walletWeight(wallet: Wallet): number {
  let steps = 0
  if (wallet.tier === 'vault') steps += 1
  if (wallet.tier === 'hot') steps -= 1
  if (wallet.stake === 'large') steps += 1
  if (wallet.stake === 'small') steps -= 1
  if (wallet.decoy) steps -= 2
  return Math.max(-2, Math.min(1, steps))
}

export interface FindingInput {
  rule: RuleId
  /** Distinguishes one instance of a rule from another. Must be stable. */
  key: string
  title: string
  detail: string
  remediation: string
  subjects: Ref[]
  severity?: Severity
  world?: string
}

export function makeFinding(plan: Plan, input: FindingInput): Finding {
  const definition = RULES[input.rule]
  const concerns = CATEGORY_CONCERN[definition.category]
  const named = concerns.some((concern) => plan.profile.concerns.includes(concern))
  return {
    id: `${input.rule}:${input.key}`,
    rule: input.rule,
    category: definition.category,
    severity: input.severity ?? definition.baseSeverity,
    title: input.title,
    detail: input.detail,
    remediation: input.remediation,
    subjects: input.subjects,
    relevance: named ? 'primary' : 'secondary',
    ...(input.world ? { world: input.world } : {}),
  }
}

/**
 * Severity first, then whether the user named the concern, then the category's
 * own order. Ties break on rule id so that the list does not shuffle between
 * runs.
 */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    if (bySeverity !== 0) return bySeverity
    if (a.relevance !== b.relevance) return a.relevance === 'primary' ? -1 : 1
    const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    if (byCategory !== 0) return byCategory
    return a.id.localeCompare(b.id)
  })
}

export function countBySeverity(findings: readonly Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  }
  for (const finding of findings) counts[finding.severity] += 1
  return counts
}
