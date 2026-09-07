import { describe, expect, it } from 'vitest'
import { accepts, AMBIENT_VOCABULARY_WORDS, firstRefusal, inspect, inspectDeep } from './guard.ts'
import { BIP39_ENGLISH, BIP39_ENGLISH_SET } from './bip39-english.ts'

describe('the wordlist itself', () => {
  it('is the whole list, exactly once each', () => {
    expect(BIP39_ENGLISH).toHaveLength(2048)
    expect(new Set(BIP39_ENGLISH).size).toBe(2048)
  })

  it('is sorted, which is what makes it the canonical list', () => {
    const sorted = [...BIP39_ENGLISH].sort()
    expect(BIP39_ENGLISH).toEqual(sorted)
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
    expect(accepts('steel plate safe abandon')).toBe(false)
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

  it('keeps every ambient word inside the wordlist', () => {
    for (const word of AMBIENT_VOCABULARY_WORDS) {
      expect(BIP39_ENGLISH_SET.has(word), word).toBe(true)
    }
    // The exception only stays defensible while it is a minority of the list.
    expect(AMBIENT_VOCABULARY_WORDS.length).toBeLessThan(512)
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
