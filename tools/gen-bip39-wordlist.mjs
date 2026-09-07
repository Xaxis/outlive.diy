#!/usr/bin/env node
/**
 * Generate the checked-in BIP-39 English wordlist used by the input guard.
 *
 * The guard has to recognise seed words in order to refuse them, which means
 * the list has to be exact: a missing word is a hole in the guard, and an extra
 * one is a false accusation against a user's own prose. Generating it from an
 * audited package and checking the result against the canonical hash is the
 * only way to be sure, and doing it here rather than at runtime keeps the
 * dependency out of the shipped bundle entirely.
 *
 *   node tools/gen-bip39-wordlist.mjs          write the file
 *   node tools/gen-bip39-wordlist.mjs --check  fail if the file is out of date
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { wordlist } from '@scure/bip39/wordlists/english.js'

// sha256 of the canonical english.txt from the BIP-39 specification, one word
// per line with a trailing newline.
const CANONICAL_SHA256 = '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda'

const OUT = new URL('../packages/core/src/guard/bip39-english.ts', import.meta.url)

if (wordlist.length !== 2048) {
  console.error(`bip39: expected 2048 words, got ${wordlist.length}`)
  process.exit(1)
}

const digest = createHash('sha256')
  .update(`${wordlist.join('\n')}\n`, 'utf8')
  .digest('hex')

if (digest !== CANONICAL_SHA256) {
  console.error(
    `bip39: wordlist hash ${digest} does not match the canonical ${CANONICAL_SHA256}. Refusing to write a list this build cannot vouch for.`
  )
  process.exit(1)
}

const lines = []
for (let index = 0; index < wordlist.length; index += 8) {
  lines.push(
    `  ${wordlist
      .slice(index, index + 8)
      .map((word) => `'${word}'`)
      .join(', ')},`
  )
}

const file = `/**
 * The BIP-39 English wordlist, 2048 words.
 *
 * GENERATED FILE. Run \`make guard-data\` to regenerate.
 *
 * This exists so the input guard can recognise seed words and refuse them. The
 * app never derives a key, never validates a mnemonic checksum and never stores
 * one; this array is used for exactly one thing, which is saying no.
 *
 * Source: @scure/bip39, english wordlist.
 * sha256 of the canonical one-word-per-line file: ${CANONICAL_SHA256}
 */

export const BIP39_ENGLISH: readonly string[] = [
${lines.join('\n')}
]

export const BIP39_ENGLISH_SET: ReadonlySet<string> = new Set(BIP39_ENGLISH)

export const BIP39_ENGLISH_SHA256 = '${CANONICAL_SHA256}'
`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    console.error(
      'bip39: packages/core/src/guard/bip39-english.ts is missing. Run make guard-data.'
    )
    process.exit(1)
  }
  if (current !== file) {
    console.error('bip39: the checked-in wordlist is out of date. Run make guard-data.')
    process.exit(1)
  }
  console.log(`bip39: wordlist current, ${wordlist.length} words, sha256 ${digest.slice(0, 12)}`)
  process.exit(0)
}

writeFileSync(OUT, file)
console.log(`bip39: wrote ${wordlist.length} words to packages/core/src/guard/bip39-english.ts`)
