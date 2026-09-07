#!/usr/bin/env node
/**
 * Make the exported site openable straight from a disk.
 *
 * `assetPrefix: './'` already handles the scripts and stylesheets, because the
 * framework writes those references into the HTML. It does not handle the two
 * paths that are written by hand: the font files a stylesheet asks for, and the
 * icon the document links to. Both are absolute, both resolve to the filesystem
 * root under file://, and both fail silently, which for a font means the page
 * quietly drops to the system stack.
 *
 * So this rewrites exactly those two, by their known depth in the output tree,
 * and refuses to finish if it did not find what it expected. Only `make
 * offline` runs it; the hosted build wants the absolute paths.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const OUT = new URL('../apps/web/out/', import.meta.url).pathname

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** How many directories deep in the output a file sits. */
function upTo(file) {
  const depth = relative(OUT, file).split('/').length - 1
  return depth === 0 ? './' : '../'.repeat(depth)
}

let fonts = 0
let icons = 0

for (const file of walk(OUT)) {
  const extension = extname(file)
  if (!['.css', '.html'].includes(extension)) continue
  const before = readFileSync(file, 'utf8')
  let after = before

  if (extension === '.css') {
    after = after.replace(/url\((['"]?)\/fonts\//g, (_, quote) => {
      fonts += 1
      return `url(${quote}${upTo(file)}fonts/`
    })
  } else {
    after = after.replace(/(href|src)="\/icon\.svg/g, (_, attribute) => {
      icons += 1
      return `${attribute}="${upTo(file)}icon.svg`
    })
  }

  if (after !== before) writeFileSync(file, after)
}

if (fonts === 0) {
  console.error('relative-assets: found no font references to rewrite. Has the CSS changed?')
  process.exit(1)
}

console.log(`relative-assets: ${fonts} font references, ${icons} icon references`)
