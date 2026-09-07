#!/usr/bin/env node
/**
 * The headline claim, enforced.
 *
 * outlive.diy makes no network calls. That is the whole basis on which somebody
 * would type their custody structure into it, and a claim like that is worth
 * nothing unless something checks it. This walks the application source and
 * fails if it finds any way to reach the network, or any reference to a host
 * that is not this one.
 *
 * It is a lint, not a proof. The Content-Security-Policy in the app's own
 * document is the enforcement; this exists so that a change that would need the
 * policy loosened is caught in review rather than after it ships.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SCANNED = [join(ROOT, 'apps/web'), join(ROOT, 'packages/core/src')]
const SKIP = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', 'coverage'])
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.html'])

/**
 * Each rule names the thing it forbids and the reason, so a failure explains
 * itself without anybody having to read this file.
 */
const FORBIDDEN = [
  {
    pattern: /\bfetch\s*\(/g,
    what: 'fetch()',
    why: 'the app must not request anything, from anywhere',
  },
  { pattern: /\bXMLHttpRequest\b/g, what: 'XMLHttpRequest', why: 'same reason as fetch' },
  { pattern: /\bnew\s+WebSocket\b/g, what: 'WebSocket', why: 'same reason as fetch' },
  { pattern: /\bnew\s+EventSource\b/g, what: 'EventSource', why: 'same reason as fetch' },
  {
    pattern: /\bnavigator\.sendBeacon\b/g,
    what: 'sendBeacon',
    why: 'that is telemetry by another name',
  },
  {
    pattern: /\bimport\s*\(\s*['"]https?:/g,
    what: 'a remote dynamic import',
    why: 'nothing is loaded at runtime',
  },
  {
    pattern: /url\(\s*['"]?https?:\/\//g,
    what: 'a remote URL in CSS',
    why: 'fonts and images are bundled, never fetched',
  },
  {
    pattern: /<(?:script|link|img|iframe)[^>]+(?:src|href)\s*=\s*['"]https?:\/\//g,
    what: 'a remote asset tag',
    why: 'nothing is loaded from another origin',
  },
]

/**
 * Hosts that may appear in source. Anything else is either a resource the app
 * would load, or a link that sends the user somewhere; both are worth a
 * deliberate decision, so both fail until listed here.
 */
const ALLOWED_HOSTS = new Set([
  'outlive.diy',
  'www.outlive.diy',
  'github.com',
  'www.w3.org', // SVG and XHTML namespaces, which are identifiers rather than addresses
  'openapi.vercel.sh', // JSON schema reference in config, never fetched by the app
])

const problems = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (EXTENSIONS.has(extname(full))) inspect(full)
  }
}

function inspect(file) {
  const source = readFileSync(file, 'utf8')
  const where = relative(ROOT, file)

  for (const rule of FORBIDDEN) {
    rule.pattern.lastIndex = 0
    let match
    while ((match = rule.pattern.exec(source)) !== null) {
      // An allow comment must say why, on the line above.
      const before = source.slice(0, match.index)
      const line = before.split('\n').length
      if (/no-network-allow:/.test(source.split('\n')[line - 2] ?? '')) continue
      problems.push(`${where}:${line}  ${rule.what} — ${rule.why}`)
    }
  }

  const urls = source.match(/https?:\/\/[^\s'"`)<>]+/g) ?? []
  for (const url of urls) {
    let host
    try {
      host = new URL(url).host
    } catch {
      continue
    }
    if (ALLOWED_HOSTS.has(host)) continue
    const line = source.slice(0, source.indexOf(url)).split('\n').length
    problems.push(`${where}:${line}  reference to ${host} — not an allowed host`)
  }
}

for (const dir of SCANNED) {
  try {
    walk(dir)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

if (problems.length > 0) {
  console.error('no-network: the application must not be able to reach the network.\n')
  for (const problem of problems) console.error(`  ${problem}`)
  console.error(
    '\nIf a match is deliberate and genuinely local, put a `no-network-allow: <reason>` comment on the line above it.'
  )
  process.exit(1)
}

console.log('no-network: no way out found in apps/web or packages/core/src')
