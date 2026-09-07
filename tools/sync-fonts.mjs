#!/usr/bin/env node
/**
 * Copy the two font files the app uses into apps/web/public/fonts.
 *
 * The fonts are self-hosted because the app must not reach the network, and
 * they are checked in rather than fetched at build time because a build that
 * needs the internet is a build that cannot be reproduced offline. Only the
 * latin subsets are taken: the rest of what the packages ship would be
 * megabytes of coverage for text this app does not render.
 *
 *   node tools/sync-fonts.mjs          copy them
 *   node tools/sync-fonts.mjs --check  fail if they are missing or stale
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'apps/web/public/fonts')

const FONTS = [
  {
    from: 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    to: 'inter-variable-latin.woff2',
  },
  {
    from: 'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
    to: 'jetbrains-mono-variable-latin.woff2',
  },
]

const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

mkdirSync(OUT, { recursive: true })
const check = process.argv.includes('--check')
let stale = false

for (const font of FONTS) {
  const source = join(ROOT, font.from)
  const target = join(OUT, font.to)
  if (!existsSync(source)) {
    console.error(`fonts: ${font.from} is missing. Run yarn install.`)
    process.exit(1)
  }
  if (check) {
    if (!existsSync(target) || digest(source) !== digest(target)) {
      console.error(`fonts: ${font.to} is missing or out of date. Run make fonts.`)
      stale = true
    }
    continue
  }
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
  console.log(`fonts: ${font.to}`)
}

if (stale) process.exit(1)
if (check) console.log('fonts: current')
