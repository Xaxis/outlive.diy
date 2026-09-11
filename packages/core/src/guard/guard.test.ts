import { describe, expect, it } from 'vitest'
import {
  accepts,
  AMBIENT_VOCABULARY_WORDS,
  BIP39_ENGLISH_PREFIXES,
  firstRefusal,
  inspect,
  inspectDeep,
} from './guard.ts'
import { BIP39_ENGLISH, BIP39_ENGLISH_SET, BIP39_ENGLISH_SHA256 } from './bip39-english.ts'

describe('the wordlist itself', () => {
  it('is the whole list, exactly once each', () => {
    expect(BIP39_ENGLISH).toHaveLength(2048)
    expect(new Set(BIP39_ENGLISH).size).toBe(2048)
  })

  it('is sorted, which is what makes it the canonical list', () => {
    const sorted = [...BIP39_ENGLISH].sort()
    expect(BIP39_ENGLISH).toEqual(sorted)
  })

  it('identifies every word uniquely by its first four letters', () => {
    // The premise of the four-letter rule below, and the reason a metal plate
    // can be stamped with four letters instead of a whole word. If this ever
    // stopped being true the rule would be refusing an ambiguity rather than a
    // seed.
    const long = BIP39_ENGLISH.filter((word) => word.length > 4)
    expect(new Set(long.map((word) => word.slice(0, 4))).size).toBe(long.length)
    expect(BIP39_ENGLISH_PREFIXES.size).toBe(long.length)
    // And no prefix collides with a whole word, so a token is one or the other.
    for (const prefix of BIP39_ENGLISH_PREFIXES) {
      expect(BIP39_ENGLISH_SET.has(prefix), prefix).toBe(false)
    }
  })

  it('hashes to the value the specification publishes', async () => {
    // The generator checks this before writing the file. Checking it again here
    // means the claim is verified by the suite rather than only by the tool
    // that produced it, which nobody runs.
    const { createHash } = await import('node:crypto')
    const digest = createHash('sha256')
      .update(`${BIP39_ENGLISH.join('\n')}\n`, 'utf8')
      .digest('hex')
    expect(digest).toBe(BIP39_ENGLISH_SHA256)
    expect(BIP39_ENGLISH_SHA256).toBe(
      '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda'
    )
  })
})

describe('seed words', () => {
  it('refuses three consecutive wordlist words', () => {
    const result = inspect('abandon ability able')
    expect(result.ok).toBe(false)
    expect(firstRefusal(result)?.kind).toBe('seed-words')
  })

  it('refuses a run buried in a sentence', () => {
    const result = inspect('the plate reads zebra zone zoo and then stops')
    expect(result.ok).toBe(false)
  })

  it('refuses twelve words', () => {
    const words = BIP39_ENGLISH.slice(0, 12).join(' ')
    expect(accepts(words)).toBe(false)
  })

  it('counts the run rather than repeating it', () => {
    const hit = firstRefusal(inspect(BIP39_ENGLISH.slice(0, 24).join(' ')))
    expect(hit?.found).toBe('24 consecutive words from the BIP-39 wordlist')
    // The message must not be a copy of the thing it is refusing.
    expect(hit?.found).not.toContain(BIP39_ENGLISH[0])
    expect(hit?.reason).not.toContain(BIP39_ENGLISH[0])
  })

  it('allows two consecutive wordlist words', () => {
    expect(BIP39_ENGLISH_SET.has('steel')).toBe(true)
    expect(BIP39_ENGLISH_SET.has('shelf')).toBe(false)
    expect(accepts('steel plate, second shelf')).toBe(true)
  })

  it('warns rather than refusing when the whole run is ordinary English', () => {
    // Every one of these is a BIP-39 word, and all of them are also the words
    // somebody would use to describe where a backup is.
    const result = inspect('steel plate safe box')
    expect(result.ok).toBe(true)
    expect(result.hits[0].kind).toBe('seed-words')
    expect(result.hits[0].strength).toBe('warn')
  })

  it('still refuses as soon as one word is outside that vocabulary', () => {
    // "avocado" rather than "abandon", which is ordinary English and is now on
    // the ambient list because this program's own prose says "a route people
    // abandon". The example has to be a word no custody note contains.
    expect(accepts('steel plate safe avocado')).toBe(false)
  })

  it('refuses every one of ten thousand generated mnemonics', () => {
    // The ambient-word exception is only defensible if it cannot let a whole
    // phrase through. This is the check, run against the real wordlist rather
    // than against the estimate.
    let state = 0x2545f491
    const next = () => {
      state = (state * 1103515245 + 12345) >>> 0
      return state / 0x100000000
    }
    for (let trial = 0; trial < 10_000; trial += 1) {
      const length = trial % 2 === 0 ? 12 : 24
      const words: string[] = []
      for (let i = 0; i < length; i += 1) words.push(BIP39_ENGLISH[Math.floor(next() * 2048)])
      const phrase = words.join(' ')
      expect(accepts(phrase), phrase).toBe(false)
    }
  })

  it('refuses a long run whatever the words are', () => {
    // Eight ordinary English words in a row, all on the wordlist. Prose does
    // not do this; a mnemonic always does.
    expect(accepts('record what you find either way first time')).toBe(false)
    // Six of the same words is the longest run this program's own prose reaches.
    expect(accepts('record what you find either way')).toBe(true)
  })

  it('refuses a mnemonic however it is punctuated', () => {
    const words = [
      'legal',
      'winner',
      'thank',
      'year',
      'wave',
      'sausage',
      'worth',
      'useful',
      'legal',
      'winner',
      'thank',
      'yellow',
    ]
    for (const separator of [' ', ', ', '\n', ' / ', '  1. ']) {
      expect(accepts(words.join(separator)), separator).toBe(false)
    }
  })

  it('refuses a real seed even though it contains storage vocabulary', () => {
    // A generated phrase will contain wordlist words that are not domain
    // vocabulary, so the exception never covers a whole mnemonic.
    const phrase = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
    expect(accepts(phrase)).toBe(false)
  })

  it('refuses a seed stamped four letters to a word', () => {
    // What a metal plate actually looks like. Four letters identify a BIP-39
    // word uniquely, so this is the seed and not a shorthand for it.
    const words = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
      .split(' ')
      .map((word) => word.slice(0, 4))
    expect(accepts(words.join(' '))).toBe(false)
    expect(accepts(words.slice(0, 8).join(' '))).toBe(false)
    // And well before the twelfth, because a field that saves as you type
    // commits whatever the guard accepted last. Four distinct pieces of
    // nonsense is the boundary: "lega winn than year" reaches it, three do not.
    expect(accepts('lega winn than saus')).toBe(false)
    expect(accepts('lega winn than year')).toBe(true)
  })

  it('leaves the short-word English that a lower boundary would have refused', () => {
    // Three distinct four-letter prefixes refuses each of these, and somebody
    // might write any of them. Four does not.
    for (const line of [
      'they said they read some plan they made last week',
      'some plan some read some note some copy some file',
      'less than half the time they read them they miss the point',
      'this plan they read last week says less',
      'keep this plan and read it once a week',
    ]) {
      expect(accepts(line), line).toBe(true)
    }
  })

  it('leaves short-word prose alone, which is what the four-letter rule risks', () => {
    // Every one of these is dense in short wordlist-or-prefix words, which is
    // the shape a false refusal would have to take. Ordinary English keeps
    // putting "and", "the" and "at" in the way, and none of those is on the
    // wordlist.
    for (const note of [
      'one copy at home and one copy in a box at the bank',
      'steel plate safe site box key card code note page',
      'plan kind draft plan name title plan copy list item',
      'keep both keys away from the same room and the same city',
      'Site A holds Key A, Site B holds Key B, Site C holds Key C',
      'check the seal, the tape, the bag, the box, the lid, the lock',
    ]) {
      expect(accepts(note), note).toBe(true)
    }
  })

  it('refuses a seed written as wordlist positions', () => {
    // Some plates are stamped with numbers. Twelve is the shortest mnemonic.
    const indices = '1017 2020 1785 2036 1998 1533 2027 1918 1017 2020 1785 2040'
    expect(accepts(indices)).toBe(false)
    expect(accepts(indices.split(' ').slice(0, 11).join(' '))).toBe(true)
    // A number outside the wordlist's range breaks the run, and a year is not
    // a wordlist position even when it looks like one.
    expect(accepts('checked in 2019 2020 2021 2022 2023 2024 2025 2026')).toBe(true)
  })

  it('refuses the entropy behind a twelve word seed, not only a longer key', () => {
    // Thirty two hexadecimal characters is 128 bits, which is the commonest
    // seed there is. Sixty four was the old threshold and let this through.
    expect(accepts('0f3b1c4d5e6f708192a3b4c5d6e7f809')).toBe(false)
    // A fingerprint is eight and stays allowed, because the plan legitimately
    // talks about one.
    expect(accepts('fingerprint 73c5da0a on that signer')).toBe(true)
  })

  /**
   * What the ambient list costs, so that widening it is a decision with a
   * number attached rather than a habit.
   *
   * A run whose every word is on the list is warned about rather than refused,
   * so this is the rate at which a short seed fragment is downgraded from
   * refusal to warning, not the rate at which one passes unremarked. Eight or
   * more consecutive wordlist words is refused whatever the words are, which
   * is where a whole phrase lives; this window is the price of not refusing
   * "keep them apart" and "one trip".
   */
  it('the price of admitting ordinary English', () => {
    const sample = (length: number) => {
      let admitted = 0
      const runs = 20000
      for (let attempt = 0; attempt < runs; attempt += 1) {
        const words: string[] = []
        for (let index = 0; index < length; index += 1) {
          words.push(BIP39_ENGLISH[Math.floor(Math.random() * BIP39_ENGLISH.length)])
        }
        if (accepts(words.join(' '))) admitted += 1
      }
      return admitted / runs
    }
    // Measured at 606 of 2048 words ambient: 2.6% of three-word runs, 0.02% of
    // seven-word ones. The bounds are loose enough not to fail on the sample
    // and tight enough that doubling the list again fails here first.
    expect(sample(3)).toBeLessThan(0.05)
    expect(sample(5)).toBeLessThan(0.01)
    expect(sample(7)).toBeLessThan(0.002)
  })

  it('keeps every ambient word inside the wordlist', () => {
    for (const word of AMBIENT_VOCABULARY_WORDS) {
      expect(BIP39_ENGLISH_SET.has(word), word).toBe(true)
    }
    // This was a quarter of the wordlist, as a stand-in for the leak it
    // permits. The test above measures that leak directly, which is the thing
    // the number was a proxy for, so this is now only a backstop against the
    // list growing without anybody thinking about it. It must stay a minority
    // of the wordlist, and well inside one.
    expect(AMBIENT_VOCABULARY_WORDS.length).toBeLessThan(BIP39_ENGLISH.length / 3)
  })

  it('does not fire on the prose people actually write in these fields', () => {
    const notes = [
      'Steel plate in the fireproof safe, second shelf from the top',
      'Bank vault, opened only with the deputy manager present',
      'Kept in a tamper evident bag, sealed and signed across the flap',
      'Air gapped signer, never connected to a computer',
      'Successor 1 has the sealed envelope but not the passphrase',
      'Check this every six months, or after any house move',
      'The lawyer holds a copy and releases it on a death certificate',
      'Two of three, with one key at a site in another flood zone',
      'Firmware last updated in spring; battery replaced at the same time',
      'This is the daily spending wallet and holds very little',
      'Backup restored and the first address matched, so this one is proven',
      'Do not type any of this into a phone or a computer, ever',
      'Steel plate in a fire proof box on the top shelf',
      'One copy at home, one copy at the office, neither near the other',
      'The safe deposit box needs my signature and photo identification',
      'Buried in a sealed tube under the third fence post, marked with a stone',
      'My brother can reach this place but does not know what is inside',
      'Hardware signer bought direct from the maker, opened on camera',
      'Wallet configuration printed twice, one copy travels with the metal plate',
      'Rehearse the recovery once a year, in winter, when there is time',
      'If I am gone, open the envelope at the solicitor and follow the first page',
      'Passphrase is memorised and written nowhere, which is the risk I accepted',
      'Small amount only, enough for everyday use and nothing more',
      'Move this to a second region before the end of the year',
      'The device asks for a PIN, and the PIN is not written down anywhere',
      'A spare unit stays in the office drawer, still sealed in its box',
      'Photograph nothing. Write nothing into a browser, a note app or a chat',
      'Site B is a four hour drive, which is the point of it',
      'Group the three shares so that no single visit collects two of them',
      'Ask the executor to contact the technical helper named on page two',
      // Each of these refused until the word that caused it was admitted as
      // ordinary English: close, type, heavy.
      'Read back every word off the metal before you close the box',
      'Never type any of this into a phone, a laptop or a browser',
      'The box is heavy; you will need help to lift the lid off',
      // And these, from a second pass: decide, aware, able, choose, alert.
      // This app is mostly about decisions, so the verbs for making one are
      // the last words that should be refused in it.
      'I still have to decide that now rather than next year',
      'Choose a second site before the winter',
      'Successor 1 should be able to open this without help',
      'Make my brother aware that the plan exists',
      'Keep an alert on the calendar so this does not slip',
      'Decide who gets to hold the spare device',
      'Nobody here is able to read a descriptor yet',
      'Stay aware that the bank changes its hours',
      'Decide now whether the child or the sibling is the executor',
      'Accept that a single vendor is a risk I am able to live with',
      'Alert the custodian that the access list has changed',
      'Ask the lawyer to explain what probate will need from them',
      'Remind me to agree this with my partner before it is final',
      'I would prefer the metal plate to the paper copy',
      'Arrange the visit so that one trip does not collect two shares',
      // And these, from the third pass: every BIP-39 word this program writes
      // in its own sentences. The vocabulary a reader was just handed is the
      // vocabulary they write back.
      'Keep them apart so that one journey cannot collect a quorum',
      'The balance here is small and the machine is air gapped',
      'One drill a year, in no hurry, with the paper copy only',
      'Treat the distance as protection against fire and not against law',
    ]
    for (const note of notes) {
      const result = inspect(note)
      const refusal = firstRefusal(result)
      expect(refusal, `refused: ${note} (${refusal?.found})`).toBeNull()
    }
  })
})

describe('key material in other shapes', () => {
  const refused: [string, string][] = [
    [
      'extended public key',
      'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8',
    ],
    [
      'extended private key',
      'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
    ],
    [
      'zpub',
      'zpub6jftahH18ngZxLmXaKw3GSZzZsszmt9WqedkyZdezFtWRFBZqsQH5hyUmb4pCEeZGmVfQuP5bedXTB8is6fTv19U1GQRyQUKQGUTzyHACMF',
    ],
    ['a WIF key', '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ'],
    ['a compressed WIF key', 'L4rK1yDtCWekvXuE6oXD9jCYfFNV2cWRpVuPLBcCU2z8TrisoyY1'],
    ['a bech32 address', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'],
    [
      'a descriptor',
      'wsh(sortedmulti(2,[abcd1234/48h/0h/0h/2h]xpubDEADBEEF/0/*,xpubCAFEBABE/0/*))',
    ],
    ['a hex blob', 'a'.repeat(64)],
    ['a private key block', '-----BEGIN EC PRIVATE KEY-----'],
  ]
  for (const [what, value] of refused) {
    it(`refuses ${what}`, () => {
      const result = inspect(`note: ${value}`)
      expect(result.ok, what).toBe(false)
    })
  }

  it('never echoes the whole match back', () => {
    const key = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ'
    const hit = firstRefusal(inspect(key))
    expect(hit).not.toBeNull()
    expect(hit?.found).not.toContain(key)
  })

  it('leaves ordinary words that start like a prefix alone', () => {
    expect(accepts('the xpub is not written here')).toBe(true)
    expect(accepts('multi signature, two of three')).toBe(true)
  })
})

describe('personal detail', () => {
  it('warns without blocking', () => {
    const result = inspect('ask them at someone@example.com')
    expect(result.ok).toBe(true)
    expect(result.hits[0].kind).toBe('email')
    expect(result.hits[0].strength).toBe('warn')
  })

  it('warns about a street address', () => {
    const result = inspect('12 Chapel Street, upstairs')
    expect(result.hits.some((hit) => hit.kind === 'street-address')).toBe(true)
  })

  it('warns about coordinates', () => {
    const result = inspect('51.50735, -0.12776')
    expect(result.hits.some((hit) => hit.kind === 'coordinates')).toBe(true)
  })
})

describe('walking a whole object', () => {
  it('finds the field a secret is hiding in', () => {
    const hits = inspectDeep({ keys: [{ label: 'Key A', notes: 'abandon ability able' }] })
    expect(hits).toHaveLength(1)
    expect(hits[0].field).toBe('keys[0].notes')
  })

  it('says nothing about a clean plan', () => {
    expect(inspectDeep({ label: 'Site B', notes: 'second shelf' })).toEqual([])
  })
})
