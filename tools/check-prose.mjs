#!/usr/bin/env node
/**
 * The house style, enforced.
 *
 * Two rules, because both drift silently and both are visible to the reader.
 *
 * No em dashes. This program's voice is plain and declarative, and an em dash
 * is almost always a comma, a colon, or two sentences that have not been
 * separated yet. Choosing one of those every time keeps the register even.
 *
 * No emoji. The interface talks about people dying and money being taken. A
 * decorative face in that copy reads as someone not taking it seriously.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SCANNED = ['apps/web', 'packages/core/src', 'tools', 'docs'].map((dir) => join(ROOT, dir))
const ROOT_FILES = ['README.md', 'CLAUDE.md'].map((file) => join(ROOT, file))
const SKIP = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', 'coverage'])
// The generated wordlist is data, and this file necessarily contains the
// characters it forbids.
const SKIP_FILES = new Set(['next-env.d.ts', 'bip39-english.ts', 'check-prose.mjs'])
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.md', '.css'])

const RULES = [
  {
    pattern: /—/g,
    what: 'an em dash',
    why: 'use a comma, a colon, parentheses, or two sentences',
  },
  {
    // The Dingbats and Miscellaneous Symbols blocks hold typographic marks as
    // well as emoji. A printed checkbox is a checkbox; a smiling face is not.
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F0FF}]/gu,
    allowed: new Set(['\u2610', '\u2611', '\u2612', '\u2713', '\u2714', '\u2717', '\u2718']),
    what: 'an emoji',
    why: 'this interface is about losing money and dying, and a decorative face reads as not taking that seriously',
  },
]

const problems = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || SKIP_FILES.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (EXTENSIONS.has(extname(full))) inspect(full)
  }
}

function inspect(file) {
  const source = readFileSync(file, 'utf8')
  const where = relative(ROOT, file)
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0
    let match
    while ((match = rule.pattern.exec(source)) !== null) {
      if (rule.allowed?.has(match[0])) continue
      const line = source.slice(0, match.index).split('\n').length
      problems.push(`${where}:${line}  ${rule.what}: ${rule.why}`)
    }
  }
}

for (const dir of SCANNED) {
  try {
    walk(dir)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
for (const file of ROOT_FILES) {
  try {
    inspect(file)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

if (problems.length > 0) {
  console.error('prose: the house style says otherwise.\n')
  for (const problem of problems.slice(0, 40)) console.error(`  ${problem}`)
  if (problems.length > 40) console.error(`  ...and ${problems.length - 40} more`)
  process.exit(1)
}

console.log('prose: no em dashes, no emoji')
