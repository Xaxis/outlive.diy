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
 *
 * What it is, and what it is not. Every form a seed is ordinarily written in is
 * recognised: whole words however they are punctuated or cased, the four-letter
 * form a metal plate is stamped in, wordlist positions, and the raw entropy in
 * hexadecimal down to the 128 bits behind a twelve word phrase. What it does
 * not recognise is a seed somebody has deliberately disguised. Running the
 * words together with no separator, interleaving a filler word between each
 * one, cutting each word to three letters, or base64 will all get past it, and
 * no pattern rule can close that: a determined author can always encode a
 * secret into text that looks like prose. This guard exists to stop a careless
 * paste and an idle "I will just note it here for now", which is how key
 * material actually ends up in a planning tool. It is not a barrier against
 * its own user, and nothing here should be described as one.
 *
 * One consequence of the fields saving as they are typed: a field commits the
 * longest value this guard accepted, so part of a seed does land while the rest
 * of it is still being typed. The thresholds here are set low enough that the
 * refusal arrives after a few words rather than after twelve, and
 * `GuardedInput` puts the stored value back to where the typing started once
 * the field is left. Between those two the window is a few words wide and a few
 * seconds long, and it is not nothing.
 */

import { BIP39_ENGLISH, BIP39_ENGLISH_SET } from './bip39-english.ts'

/**
 * The four-letter prefixes of every wordlist word longer than four letters.
 *
 * BIP-39 guarantees that the first four letters identify a word uniquely, which
 * is why metal backup plates are stamped with four letters and not whole words.
 * A list of them is a complete seed phrase, written the way the hardware writes
 * it, so the guard has to recognise it as one.
 *
 * Derived here rather than written into the wordlist file, which holds only
 * what the generator emits and is checked against the canonical list. None of
 * these is itself a wordlist word, so a token is a word or a prefix and never
 * ambiguously both; the 545 words of four letters or fewer are their own prefix
 * and are already in the set above.
 */
export const BIP39_ENGLISH_PREFIXES: ReadonlySet<string> = new Set(
  BIP39_ENGLISH.filter((word) => word.length > 4).map((word) => word.slice(0, 4))
)

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
    // Thirty two, not sixty four. Sixty four hexadecimal characters is a
    // 256-bit key, and thirty two is the 128-bit entropy behind a twelve word
    // seed, which is the commonest seed there is. A checksum of that length
    // being refused costs a reword; the other way costs a seed.
    pattern: /\b[0-9a-fA-F]{32,}\b/g,
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

/** How many wordlist positions in a row are a seed rather than a coincidence. */
const SEED_INDEX_RUN = 12

/**
 * How many distinct four-letter prefixes that are not words at all make a run a
 * stamped seed. Measured: ordinary English reaches two, a stamped twelve word
 * phrase reaches seven, and three refuses sentences a person might write.
 */
const STAMPED_RUN = 4

/**
 * BIP-39 words that are also ordinary English or ordinary storage vocabulary.
 * Every entry is verified against the wordlist by the test suite.
 *
 * The list is maintained by measurement, not by intuition, in two passes. A
 * corpus of notes a person would type into these fields, in guard.test.ts,
 * with every false refusal chased to the word that caused it. And every BIP-39
 * word this program writes in its own sentences, because the vocabulary a
 * reader has just been handed is the vocabulary they write back: this file
 * refused "aware that", "decide that now" and "that one trip" while the
 * findings beside it were saying distance, balance, machine, hurry and apart.
 *
 * A guard that refuses ordinary sentences teaches people to phrase things
 * around it, and the next thing they phrase around it is a seed word. The
 * price is paid in the three-to-seven window and it is measured in the test
 * called "the price of admitting ordinary English": a run whose every word is
 * on this list still produces a warning, so what widening it moves is
 * refusals to warnings, never anything to silence. Eight or more consecutive
 * wordlist words is refused whatever they are, which is where a real phrase
 * lives.
 */
const AMBIENT_VOCABULARY: ReadonlySet<string> = new Set([
  'abandon',
  'able',
  'about',
  'above',
  'absorb',
  'access',
  'account',
  'acquire',
  'across',
  'act',
  'add',
  'address',
  'advance',
  'again',
  'agree',
  'air',
  'airport',
  'alert',
  'all',
  'alley',
  'allow',
  'almost',
  'alone',
  'already',
  'also',
  'always',
  'among',
  'amount',
  'announce',
  'another',
  'answer',
  'any',
  'apart',
  'appear',
  'area',
  'around',
  'arrange',
  'arrive',
  'ask',
  'assume',
  'aunt',
  'autumn',
  'aware',
  'away',
  'bag',
  'balance',
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
  'brand',
  'brick',
  'bridge',
  'brief',
  'bring',
  'brother',
  'budget',
  'build',
  'bulk',
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
  'caught',
  'cause',
  'ceiling',
  'century',
  'certain',
  'change',
  'chat',
  'check',
  'child',
  'choice',
  'choose',
  'city',
  'claim',
  'clay',
  'clean',
  'clip',
  'clock',
  'close',
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
  'cousin',
  'cover',
  'crack',
  'crime',
  'cross',
  'current',
  'cycle',
  'damp',
  'danger',
  'day',
  'deal',
  'decide',
  'delay',
  'demand',
  'depend',
  'deposit',
  'describe',
  'desert',
  'destroy',
  'detail',
  'device',
  'differ',
  'digital',
  'direct',
  'distance',
  'document',
  'door',
  'double',
  'draft',
  'drill',
  'drive',
  'drop',
  'dry',
  'during',
  'dust',
  'early',
  'earth',
  'east',
  'easy',
  'edge',
  'either',
  'element',
  'else',
  'empty',
  'end',
  'engine',
  'enough',
  'enter',
  'entry',
  'envelope',
  'estate',
  'example',
  'exchange',
  'exclude',
  'exist',
  'exit',
  'expect',
  'explain',
  'extra',
  'fall',
  'family',
  'fatal',
  'father',
  'fault',
  'fee',
  'fence',
  'few',
  'field',
  'file',
  'final',
  'find',
  'fine',
  'finish',
  'fire',
  'firm',
  'first',
  'flight',
  'floor',
  'follow',
  'forest',
  'forget',
  'found',
  'fragile',
  'frame',
  'fresh',
  'front',
  'frozen',
  'gap',
  'garage',
  'garden',
  'gate',
  'general',
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
  'hard',
  'have',
  'hazard',
  'head',
  'heavy',
  'help',
  'high',
  'hill',
  'history',
  'hold',
  'home',
  'hotel',
  'hour',
  'human',
  'hurry',
  'ice',
  'idea',
  'include',
  'increase',
  'index',
  'inform',
  'inherit',
  'inner',
  'input',
  'inside',
  'intact',
  'into',
  'involve',
  'iron',
  'island',
  'issue',
  'item',
  'jar',
  'journey',
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
  'load',
  'lock',
  'long',
  'love',
  'machine',
  'main',
  'make',
  'man',
  'margin',
  'market',
  'match',
  'material',
  'matter',
  'mean',
  'measure',
  'media',
  'member',
  'memory',
  'mesh',
  'message',
  'metal',
  'middle',
  'mind',
  'minute',
  'mistake',
  'mix',
  'mobile',
  'moment',
  'month',
  'more',
  'morning',
  'mother',
  'mountain',
  'move',
  'much',
  'must',
  'name',
  'near',
  'need',
  'neither',
  'nephew',
  'never',
  'next',
  'night',
  'normal',
  'north',
  'note',
  'nothing',
  'notice',
  'now',
  'number',
  'object',
  'occur',
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
  'ordinary',
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
  'pass',
  'path',
  'payment',
  'people',
  'perfect',
  'person',
  'phone',
  'photo',
  'phrase',
  'physical',
  'picture',
  'piece',
  'place',
  'plate',
  'play',
  'plug',
  'point',
  'police',
  'position',
  'possible',
  'post',
  'power',
  'prefer',
  'prepare',
  'present',
  'print',
  'private',
  'problem',
  'process',
  'produce',
  'proof',
  'protect',
  'public',
  'purpose',
  'purse',
  'put',
  'question',
  'quick',
  'race',
  'rain',
  'raise',
  'random',
  'rate',
  'rather',
  'ready',
  'real',
  'reason',
  'rebuild',
  'recall',
  'receive',
  'record',
  'reduce',
  'reflect',
  'region',
  'release',
  'rely',
  'remain',
  'remember',
  'remind',
  'remove',
  'renew',
  'repair',
  'repeat',
  'replace',
  'report',
  'require',
  'resist',
  'result',
  'return',
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
  'search',
  'season',
  'second',
  'secret',
  'section',
  'seed',
  'sense',
  'sentence',
  'service',
  'session',
  'setup',
  'share',
  'shed',
  'ship',
  'shop',
  'short',
  'side',
  'sign',
  'silent',
  'silver',
  'since',
  'sister',
  'six',
  'skill',
  'slab',
  'small',
  'smoke',
  'snow',
  'someone',
  'soon',
  'sorry',
  'sort',
  'sound',
  'source',
  'south',
  'space',
  'spare',
  'speak',
  'speed',
  'spend',
  'split',
  'spot',
  'spread',
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
  'stock',
  'stone',
  'story',
  'street',
  'such',
  'summer',
  'supply',
  'sure',
  'surface',
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
  'thank',
  'that',
  'then',
  'there',
  'they',
  'thing',
  'this',
  'thought',
  'three',
  'throw',
  'time',
  'title',
  'today',
  'together',
  'tool',
  'top',
  'total',
  'toward',
  'town',
  'track',
  'train',
  'transfer',
  'travel',
  'treat',
  'tree',
  'trip',
  'truck',
  'true',
  'trust',
  'try',
  'tube',
  'tunnel',
  'turn',
  'twice',
  'two',
  'type',
  'unable',
  'uncle',
  'under',
  'unit',
  'unknown',
  'unlock',
  'until',
  'update',
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
  'worth',
  'write',
  'wrong',
  'yard',
  'year',
  'you',
  'young',
  'zero',
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

/**
 * A seed written the way a metal plate is stamped: four letters per word.
 *
 * BIP-39 guarantees the first four letters identify a word uniquely, so this is
 * a complete seed phrase and not a shorthand for one. It is a separate pass
 * from the one above rather than a widening of it, because a four-letter prefix
 * is a far weaker signal than a whole word and must not be allowed to join,
 * extend or split a run of whole words.
 *
 * Every token four letters or fewer, which is what a stamped plate looks like
 * and what ordinary prose does not manage for long: "and", "the", "at" and
 * their kind are not in the wordlist and break the run. Within such a run, four
 * distinct tokens that are prefixes and not words at all: four pieces of
 * nonsense together, which is what a seed looks like well before the twelfth
 * word has been typed.
 *
 * Four, and distinct, and nothing about the length of the run. Three refuses
 * "they said they read some plan they made last week". Counting repeats
 * refuses "plan plan plan", which this program's own source contains. And a
 * long run with one piece of nonsense in it refuses "some plan some read some
 * note some copy some file", where the nonsense is "plan" and "read".
 */
function findStampedRuns(text: string): GuardHit[] {
  const hits: GuardHit[] = []
  let run: Token[] = []

  const flush = () => {
    // Tokens that are a prefix and not a word at all: "lega", "winn", "saus".
    // Nonsense in English, and four distinct ones in a row is the signal. The
    // whole run reaching the hard length is the other. Distinct, because prose
    // repeats a word and a seed does not: the worst this repository's own prose
    // manages is "plan plan plan", which is one.
    const nonsense = new Set(
      run.filter((token) => !BIP39_ENGLISH_SET.has(token.word)).map((token) => token.word)
    )
    if (nonsense.size >= STAMPED_RUN) {
      hits.push({
        kind: 'seed-words',
        strength: 'refuse',
        start: run[0].start,
        end: run[run.length - 1].end,
        found: `${run.length} consecutive BIP-39 words, shortened to four letters`,
        reason:
          'Four letters identify a BIP-39 word uniquely, which is why a metal plate is stamped with four and not with the whole word. That is a seed phrase.',
        instead:
          'Write down what the backup is and where it lives: "Key A, steel plate, Site B". The seed itself belongs on metal, in a place, and nowhere else.',
      })
    }
    run = []
  }

  for (const token of tokenize(text)) {
    const known = BIP39_ENGLISH_SET.has(token.word) || BIP39_ENGLISH_PREFIXES.has(token.word)
    if (known && token.word.length <= 4) run.push(token)
    else flush()
  }
  flush()
  return hits
}

/**
 * Wordlist positions, which is the other way a seed gets written down: some
 * metal plates are stamped with numbers rather than letters.
 *
 * Twelve is the shortest real mnemonic, and twelve numbers in a row that all
 * land inside the wordlist's range is not a thing that happens in a sentence
 * about where a backup is kept.
 */
function findIndexRuns(text: string): GuardHit[] {
  const hits: GuardHit[] = []
  const pattern = /[A-Za-z]+|\d+/g
  let run: { start: number; end: number }[] = []
  let match: RegExpExecArray | null

  const flush = () => {
    if (run.length >= SEED_INDEX_RUN) {
      hits.push({
        kind: 'seed-words',
        strength: 'refuse',
        start: run[0].start,
        end: run[run.length - 1].end,
        found: `${run.length} numbers in a row, every one of them a BIP-39 wordlist position`,
        reason:
          'That is a seed phrase written as wordlist positions, which is how some metal plates are stamped.',
        instead:
          'Write down what the backup is and where it lives: "Key A, steel plate, Site B". The seed itself belongs on metal, in a place, and nowhere else.',
      })
    }
    run = []
  }

  while ((match = pattern.exec(text)) !== null) {
    const value = Number(match[0])
    if (/^\d+$/.test(match[0]) && value >= 1 && value <= BIP39_ENGLISH.length) {
      run.push({ start: match.index, end: match.index + match[0].length })
    } else {
      flush()
    }
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
  const hits: GuardHit[] = [...findSeedRuns(text), ...findStampedRuns(text), ...findIndexRuns(text)]

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
