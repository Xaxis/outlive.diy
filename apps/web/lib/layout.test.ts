import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * One column, one left edge.
 *
 * Every view used to centre itself at whatever width suited its content, so
 * clicking down the sidebar moved the heading sideways by up to two hundred
 * pixels a step. The shell owns the column now and a view picks one of two
 * measures inside it.
 *
 * This is checked in the source rather than by measuring a rendered page,
 * because the test environment has no layout engine and the mistake is a
 * class name.
 */

const VIEWS = join(process.cwd(), 'components/views')

// The landing page is the one screen with no sidebar beside it, so centring
// there is correct and is not what this rule is about.
const OUTSIDE_THE_SHELL = new Set(['Welcome.tsx'])

const files = readdirSync(VIEWS).filter(
  (name) => name.endsWith('.tsx') && !OUTSIDE_THE_SHELL.has(name)
)

describe('every view sits in the same column', () => {
  it('finds the views', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const name of files) {
    const source = readFileSync(join(VIEWS, name), 'utf8')

    it(`${name} does not centre itself`, () => {
      // `mx-auto max-w-*` is the exact shape that moved the left edge.
      expect(source).not.toMatch(/mx-auto\s+max-w-/)
    })

    it(`${name} declares a measure`, () => {
      expect(source).toMatch(/MEASURE\.(wide|read)/)
    })
  }
})
