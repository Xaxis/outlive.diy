/**
 * The input guard.
 *
 * This app reasons about the shape of a custody setup and must never hold the
 * secrets inside it. That is not a policy note; it is enforced here, on every
 * free-text field, before anything is stored. The guard is a headline feature
 * rather than an obstacle: a planning tool that will happily accept your seed
 * words is a planning tool that has become a liability, and the only way a user
 * can trust this one is if refusing is something it visibly does.
 *
 * Two strengths of response. A `refuse` hit blocks the input and says exactly
 * what was recognised and why. A `warn` hit is advisory: it is not key material
 * but it is the kind of personal detail this model is designed not to hold.
 *
 * Matched text is never echoed back in full. The message describes what was
 * found, not what it said.
 */

import { BIP39_ENGLISH_SET } from './bip39-english.ts'

export type GuardStrength = 'refuse' | 'warn'

export type GuardKind =
  | 'seed-words'
  | 'extended-key'
  | 'private-key'
  | 'address'
  | 'descriptor'
  | 'derivation-path'
  | 'key-block'
  | 'hex-blob'
  | 'email'
  | 'phone'
  | 'street-address'
  | 'coordinates'
  | 'url'

export interface GuardHit {
  kind: GuardKind
  strength: GuardStrength
  /** Position in the input, for highlighting. */
  start: number
  end: number
  /** A description of what matched. Never the match itself, in full. */
  found: string
  /** Why this app will not hold it, addressed to the person who typed it. */
  reason: string
  /** What to write instead. */
  instead: string
}

export interface GuardResult {
  /** False when anything was refused. */
  ok: boolean
  hits: GuardHit[]
}

const CLEAN: GuardResult = { ok: true, hits: [] }

/** Show enough to locate it in the field, never enough to be a copy of it. */
function mask(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 4) return '•'.repeat(trimmed.length)
  return `${trimmed.slice(0, 4)}${'•'.repeat(Math.min(10, trimmed.length - 4))}`
}

interface PatternRule {
  kind: GuardKind
  strength: GuardStrength
  pattern: RegExp
  reason: string
  instead: string
  describe?: (match: string) => string
}

/**
 * Ordered so that the most specific rule reports first. Every pattern is
 * anchored on a word boundary rather than a bare substring, because a rule that
 * fires on ordinary prose trains the user to work around the guard.
 */
const RULES: PatternRule[] = [
  {
    kind: 'key-block',
    strength: 'refuse',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY[A-Z ]*-----/g,
    reason: 'That is a private key block.',
    instead:
      'Nothing about a private key belongs in this app. Record only that a key exists and where it is kept.',
    describe: () => 'a private key block',
  },
  {
    kind: 'extended-key',
    strength: 'refuse',
    pattern: /\b(?:xprv|yprv|zprv|tprv|uprv|vprv|Yprv|Zprv)[1-9A-HJ-NP-Za-km-z]{20,}/g,
    reason: 'That is an extended private key.',
    instead: 'Describe the key by its role instead: "Key A", and where its backup lives.',
    describe: (match) => `an extended private key (${match.slice(0, 4)}…)`,
  },
  {
    kind: 'extended-key',
    strength: 'refuse',
    pattern: /\b(?:xpub|ypub|zpub|tpub|upub|vpub|Ypub|Zpub)[1-9A-HJ-NP-Za-km-z]{20,}/g,
    reason: 'That is an extended public key.',
    instead:
      'Even public keys are omitted here, because together they identify the wallet and everything it has ever done. Record the wallet by its role: "Vault", 2-of-3.',
    describe: (match) => `an extended public key (${match.slice(0, 4)}…)`,
  },
  {
    kind: 'private-key',
    strength: 'refuse',
    pattern: /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g,
    reason: 'That looks like a private key in wallet import format.',
    instead: 'Record the key by its role and its location, not its value.',
    describe: (match) => `a WIF private key (${mask(match)})`,
  },
  {
    kind: 'private-key',
    strength: 'refuse',
    pattern: /\b[9c][1-9A-HJ-NP-Za-km-z]{50,51}\b/g,
    reason: 'That looks like a testnet private key in wallet import format.',
    instead: 'Record the key by its role and its location, not its value.',
    describe: (match) => `a WIF private key (${mask(match)})`,
  },
  {
    kind: 'address',
    strength: 'refuse',
    pattern: /\b(?:bc1|tb1|bcrt1)[02-9ac-hj-np-z]{20,}\b/gi,
    reason: 'That is a Bitcoin address.',
    instead:
      'Addresses tie this plan to an on-chain history, which is exactly the link this app exists not to make. Nothing here needs one.',
    describe: (match) => `a Bitcoin address (${match.slice(0, 4)}…)`,
  },
  {
    kind: 'descriptor',
    strength: 'refuse',
    pattern: /\b(?:sortedmulti|multi|wsh|wpkh|sh|pkh|tr|combo|addr|raw)\(\s*[^)]{6,}/g,
    reason: 'That is an output descriptor.',
    instead:
      'The descriptor is the one thing you must back up outside this app, on paper, with the seeds. Here, record only that a copy exists and which location holds it.',
    describe: () => 'an output descriptor',
  },
  {
    kind: 'hex-blob',
    strength: 'refuse',
    pattern: /\b[0-9a-fA-F]{64,}\b/g,
    reason: 'That is a long hexadecimal string.',
    instead:
      'A raw seed, a private key and a signed transaction all look like this. If it is genuinely none of those, describe it in words instead.',
    describe: (match) => `${match.length} hexadecimal characters`,
  },
  {
    kind: 'derivation-path',
    strength: 'warn',
    pattern: /\[[0-9a-fA-F]{8}(?:\/\d+['h]?)+\]|\bm(?:\/\d+['h]?){2,}/g,
    reason: 'That is a derivation path, and often a key fingerprint with it.',
    instead:
      'It is not a secret, but it belongs with the wallet configuration backup rather than in a planning note.',
    describe: () => 'a derivation path',
  },
  {
    kind: 'email',
    strength: 'warn',
    pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g,
    reason: 'That is an email address.',
    instead:
      'People are recorded by role here: "Successor 1". Keep contact details in the sealed instructions, not in the plan.',
    describe: () => 'an email address',
  },
  {
    kind: 'url',
    strength: 'warn',
    pattern: /\bhttps?:\/\/\S{4,}/g,
    reason: 'That is a link.',
    instead:
      'This app never opens one, and a link in a custody note is usually a place a secret ended up.',
    describe: () => 'a URL',
  },
  {
    kind: 'coordinates',
    strength: 'warn',
    pattern: /\b-?\d{1,2}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g,
    reason: 'Those are geographic coordinates.',
    instead: 'Locations are roles here: "Site B". A coordinate is a map to your backups.',
    describe: () => 'a coordinate pair',
  },
  {
    kind: 'street-address',
    strength: 'warn',
    pattern:
      /\b\d{1,5}\s+[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,3}\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Way|Close|Terrace|Place|Pl)\b\.?/g,
    reason: 'That looks like a street address.',
    instead:
      'Locations are roles here: "Site B". The address belongs in the sealed instructions, not in the file you carry around.',
    describe: () => 'a street address',
  },
  {
    kind: 'phone',
    strength: 'warn',
    pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g,
    reason: 'That looks like a phone number.',
    instead: 'People are recorded by role here. Contact details belong in the sealed instructions.',
    describe: () => 'a phone number',
  },
]

/**
 * Where the seed-word rule draws its line.
 *
 * The rule is three or more consecutive wordlist words, and taken literally it
 * misfires on exactly the prose these fields are for. "Steel plate, safe" is
 * three BIP-39 words and is also the most ordinary sentence a person could
 * write about a backup. A guard that refuses it teaches the user to work around
 * the guard, which costs more than it saves. BIP-39 is drawn from common
 * English, so this is not a rare accident: it is the normal case.
 *
 * Two thresholds instead of one, then.
 *
 * A run of eight or more is refused outright, whatever the words are. English
 * prose does not produce runs that long: measured across every sentence this
 * program generates, the longest is six. A mnemonic is twelve words or more
 * with nothing between them, so it is always caught here.
 *
 * A run of three to seven is refused unless every word in it is *ambient*:
 * high-frequency English, or the storage vocabulary these fields are written
 * in. An all-ambient run of that length is still reported, as a warning, so a
 * user who has genuinely pasted a fragment of a seed still sees it.
 */
/** Below this, a run is not worth mentioning at all. */
const SEED_RUN_THRESHOLD = 3

/** At or above this, a run is refused whatever the words are. */
const HARD_SEED_RUN = 8

/**
 * BIP-39 words that are also ordinary English or ordinary storage vocabulary.
 * Every entry is verified against the wordlist by the test suite.
 */
const AMBIENT_VOCABULARY: ReadonlySet<string> = new Set([
  'about',
  'above',
  'absorb',
  'access',
  'acquire',
  'across',
  'act',
  'address',
  'again',
  'airport',
  'all',
  'alley',
  'almost',
  'alone',
  'already',
  'also',
  'always',
  'among',
  'amount',
  'another',
  'answer',
  'any',
  'appear',
  'area',
  'around',
  'arrive',
  'ask',
  'aunt',
  'autumn',
  'away',
  'bag',
  'bar',
  'base',
  'basic',
  'because',
  'become',
  'before',
  'begin',
  'behind',
  'believe',
  'below',
  'belt',
  'best',
  'better',
  'between',
  'beyond',
  'boat',
  'book',
  'border',
  'bottom',
  'box',
  'brick',
  'bridge',
  'bring',
  'brother',
  'build',
  'business',
  'cabin',
  'cable',
  'call',
  'camera',
  'can',
  'car',
  'card',
  'carry',
  'case',
  'cause',
  'ceiling',
  'certain',
  'change',
  'check',
  'child',
  'city',
  'claim',
  'clay',
  'clip',
  'clock',
  'cloud',
  'code',
  'coin',
  'collect',
  'column',
  'come',
  'common',
  'company',
  'confirm',
  'consider',
  'control',
  'copper',
  'copy',
  'country',
  'course',
  'cover',
  'crack',
  'crime',
  'cross',
  'cycle',
  'damp',
  'danger',
  'day',
  'deposit',
  'describe',
  'desert',
  'device',
  'differ',
  'document',
  'door',
  'double',
  'draft',
  'drive',
  'during',
  'dust',
  'early',
  'earth',
  'east',
  'edge',
  'either',
  'else',
  'end',
  'engine',
  'enough',
  'enter',
  'entry',
  'envelope',
  'estate',
  'example',
  'exit',
  'expect',
  'extra',
  'fall',
  'family',
  'father',
  'fault',
  'fence',
  'few',
  'field',
  'file',
  'final',
  'find',
  'fire',
  'first',
  'flight',
  'floor',
  'follow',
  'forest',
  'forget',
  'found',
  'frame',
  'front',
  'frozen',
  'garage',
  'garden',
  'gate',
  'gift',
  'give',
  'glass',
  'glue',
  'gold',
  'good',
  'great',
  'grid',
  'grief',
  'group',
  'grow',
  'guard',
  'half',
  'hammer',
  'hand',
  'harbor',
  'have',
  'head',
  'help',
  'high',
  'hill',
  'hold',
  'home',
  'hotel',
  'hour',
  'ice',
  'idea',
  'include',
  'increase',
  'index',
  'inner',
  'inside',
  'into',
  'iron',
  'island',
  'item',
  'jar',
  'judge',
  'just',
  'keep',
  'key',
  'kind',
  'kit',
  'know',
  'label',
  'large',
  'later',
  'law',
  'lawn',
  'learn',
  'leave',
  'left',
  'legal',
  'letter',
  'level',
  'life',
  'lift',
  'like',
  'link',
  'list',
  'little',
  'live',
  'lock',
  'long',
  'love',
  'main',
  'make',
  'man',
  'market',
  'material',
  'mean',
  'memory',
  'mesh',
  'metal',
  'middle',
  'mind',
  'minute',
  'month',
  'more',
  'mother',
  'mountain',
  'move',
  'much',
  'must',
  'name',
  'near',
  'need',
  'neither',
  'never',
  'next',
  'night',
  'north',
  'note',
  'nothing',
  'notice',
  'now',
  'number',
  'object',
  'off',
  'offer',
  'office',
  'often',
  'old',
  'once',
  'one',
  'only',
  'open',
  'order',
  'original',
  'other',
  'outer',
  'outside',
  'over',
  'own',
  'page',
  'panel',
  'paper',
  'party',
  'path',
  'people',
  'person',
  'phone',
  'photo',
  'phrase',
  'picture',
  'place',
  'plate',
  'play',
  'plug',
  'point',
  'police',
  'possible',
  'post',
  'power',
  'present',
  'print',
  'problem',
  'process',
  'produce',
  'proof',
  'protect',
  'purse',
  'put',
  'question',
  'quick',
  'rain',
  'rather',
  'ready',
  'real',
  'reason',
  'receive',
  'record',
  'region',
  'remain',
  'remember',
  'renew',
  'repair',
  'replace',
  'report',
  'resist',
  'result',
  'right',
  'ring',
  'risk',
  'river',
  'road',
  'roof',
  'room',
  'round',
  'route',
  'rule',
  'run',
  'safe',
  'same',
  'sand',
  'say',
  'school',
  'screen',
  'season',
  'second',
  'secret',
  'seed',
  'sense',
  'session',
  'share',
  'shed',
  'ship',
  'shop',
  'short',
  'side',
  'sign',
  'silver',
  'since',
  'sister',
  'six',
  'slab',
  'small',
  'smoke',
  'snow',
  'someone',
  'soon',
  'sort',
  'sound',
  'south',
  'space',
  'spare',
  'speak',
  'spend',
  'split',
  'spot',
  'spring',
  'stairs',
  'stamp',
  'stand',
  'start',
  'state',
  'stay',
  'steel',
  'step',
  'still',
  'stone',
  'story',
  'street',
  'such',
  'summer',
  'supply',
  'sure',
  'switch',
  'system',
  'table',
  'talk',
  'tape',
  'tell',
  'tent',
  'term',
  'test',
  'text',
  'that',
  'then',
  'there',
  'they',
  'thing',
  'this',
  'thought',
  'three',
  'time',
  'today',
  'together',
  'tool',
  'top',
  'toward',
  'town',
  'track',
  'train',
  'travel',
  'tree',
  'truck',
  'true',
  'trust',
  'try',
  'tube',
  'tunnel',
  'turn',
  'twice',
  'two',
  'uncle',
  'under',
  'unit',
  'until',
  'upon',
  'upper',
  'use',
  'used',
  'valley',
  'van',
  'vault',
  'vendor',
  'verify',
  'version',
  'very',
  'view',
  'village',
  'visit',
  'voice',
  'wait',
  'walk',
  'wall',
  'want',
  'water',
  'way',
  'west',
  'what',
  'wheel',
  'when',
  'where',
  'wide',
  'will',
  'window',
  'winter',
  'wire',
  'witness',
  'wood',
  'word',
  'work',
  'world',
  'write',
  'wrong',
  'yard',
  'year',
  'you',
  'young',
  'zone',
])

interface Token {
  word: string
  start: number
  end: number
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const pattern = /[A-Za-z]+/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    tokens.push({
      word: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return tokens
}

function findSeedRuns(text: string): GuardHit[] {
  const tokens = tokenize(text)
  const hits: GuardHit[] = []
  let run: Token[] = []

  const flush = () => {
    if (run.length >= SEED_RUN_THRESHOLD) {
      const ambient =
        run.length < HARD_SEED_RUN && run.every((token) => AMBIENT_VOCABULARY.has(token.word))
      hits.push({
        kind: 'seed-words',
        strength: ambient ? 'warn' : 'refuse',
        start: run[0].start,
        end: run[run.length - 1].end,
        found: `${run.length} consecutive words from the BIP-39 wordlist`,
        reason: ambient
          ? 'Those are all BIP-39 words, though each is also an ordinary English word, so this is a note rather than a refusal.'
          : 'Those are seed words. This app never accepts them, never stores them and cannot help you with them.',
        instead: ambient
          ? 'If any of them is part of a seed phrase, take it out. Seed words belong on metal, in a place, and nowhere else.'
          : 'Write down what the backup is and where it lives: "Key A, steel plate, Site B". The words themselves belong on metal, in a place, and nowhere else.',
      })
    }
    run = []
  }

  for (const token of tokens) {
    if (BIP39_ENGLISH_SET.has(token.word)) run.push(token)
    else flush()
  }
  flush()
  return hits
}

/** Exported so the test suite can prove every entry is a real wordlist word. */
export const AMBIENT_VOCABULARY_WORDS: readonly string[] = [...AMBIENT_VOCABULARY]

/**
 * Inspect a single free-text value.
 *
 * Refusals come first in the returned list, because the UI shows the first hit
 * most prominently and a refusal is the one the user has to act on.
 */
export function inspect(text: string): GuardResult {
  if (text.length === 0) return CLEAN
  const hits: GuardHit[] = [...findSeedRuns(text)]

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.pattern.exec(text)) !== null) {
      hits.push({
        kind: rule.kind,
        strength: rule.strength,
        start: match.index,
        end: match.index + match[0].length,
        found: rule.describe ? rule.describe(match[0]) : mask(match[0]),
        reason: rule.reason,
        instead: rule.instead,
      })
      if (match[0].length === 0) rule.pattern.lastIndex += 1
    }
  }

  // A descriptor and a hex blob can cover the same characters. Report the
  // outermost hit only, so the message names one thing rather than three.
  const ordered = hits.sort((a, b) =>
    a.strength === b.strength ? a.start - b.start : a.strength === 'refuse' ? -1 : 1
  )
  const kept: GuardHit[] = []
  for (const hit of ordered) {
    const covered = kept.some(
      (existing) =>
        existing.strength === hit.strength && existing.start <= hit.start && existing.end >= hit.end
    )
    if (!covered) kept.push(hit)
  }

  return { ok: !kept.some((hit) => hit.strength === 'refuse'), hits: kept }
}

/** True when the value may be stored. Warnings do not block. */
export function accepts(text: string): boolean {
  return inspect(text).ok
}

/** The first refusal, which is the one worth showing beside the field. */
export function firstRefusal(result: GuardResult): GuardHit | null {
  return result.hits.find((hit) => hit.strength === 'refuse') ?? null
}

export interface FieldHit extends GuardHit {
  /** Dotted path to the field inside the plan. */
  field: string
}

/**
 * Walk every string in an object and inspect it. Used when a plan file is
 * opened, so that a file carrying secrets is refused at the door rather than
 * loaded and quietly re-saved.
 */
export function inspectDeep(value: unknown, path = ''): FieldHit[] {
  if (typeof value === 'string') {
    return inspect(value).hits.map((hit) => ({ ...hit, field: path || 'value' }))
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => inspectDeep(entry, `${path}[${index}]`))
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) =>
      inspectDeep(entry, path ? `${path}.${key}` : key)
    )
  }
  return []
}
