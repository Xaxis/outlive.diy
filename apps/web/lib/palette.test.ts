import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The palette has to stay readable.
 *
 * An accessibility audit catches this too, but only when somebody runs a
 * browser over every screen. The ratios are arithmetic on twelve numbers, so
 * they can be checked here, on every commit, in a millisecond.
 *
 * WCAG AA is 4.5:1 for body text. Every step of the text ramp is held to it
 * against every ground it is ever placed on, because "faint" in this interface
 * means metadata rather than decoration: dates, counts, rule ids, the line
 * under a heading. All of it is meant to be read.
 */

// Read from the workspace root; the DOM environment these tests run in does
// not provide a file-scheme import.meta.url.
const CSS = readFileSync(join(process.cwd(), 'styles/globals.css'), 'utf8')

function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector)
  if (start === -1) throw new Error(`no ${selector} block in globals.css`)
  const open = CSS.indexOf('{', start)
  const close = CSS.indexOf('}', open)
  const entries: Record<string, string> = {}
  for (const line of CSS.slice(open + 1, close).split('\n')) {
    const match = /^\s*(--c-[\w-]+):\s*(#[0-9a-fA-F]{6});/.exec(line)
    if (match) entries[match[1]] = match[2]
  }
  return entries
}

function channel(value: number): number {
  const srgb = value / 255
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const r = channel(Number.parseInt(hex.slice(1, 3), 16))
  const g = channel(Number.parseInt(hex.slice(3, 5), 16))
  const b = channel(Number.parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

const THEMES: [string, string][] = [
  ['dark', ":root,\n[data-theme='dark']"],
  ['light', "[data-theme='light']"],
]

const TEXT = ['--c-body', '--c-strong', '--c-muted', '--c-faint']
const GROUNDS = ['--c-canvas', '--c-surface', '--c-raised', '--c-sunken']

describe('the palette', () => {
  for (const [name, selector] of THEMES) {
    describe(name, () => {
      const tokens = block(selector)

      it('defines every colour the theme needs', () => {
        for (const token of [...TEXT, ...GROUNDS, '--c-accent', '--c-critical', '--c-ok']) {
          expect(tokens[token], token).toMatch(/^#[0-9a-f]{6}$/i)
        }
      })

      for (const text of TEXT) {
        for (const ground of GROUNDS) {
          it(`${text} reads on ${ground}`, () => {
            const ratio = contrast(tokens[text], tokens[ground])
            expect(
              ratio,
              `${tokens[text]} on ${tokens[ground]} is ${ratio.toFixed(2)}:1`
            ).toBeGreaterThanOrEqual(4.5)
          })
        }
      }

      it('the accent reads on the ground it is placed on', () => {
        // Links and the current-view marker, on canvas and on surface.
        for (const ground of ['--c-canvas', '--c-surface']) {
          const ratio = contrast(tokens['--c-accent'], tokens[ground])
          expect(ratio, `accent on ${ground} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
        }
      })

      it('a primary button reads against its own fill', () => {
        const ratio = contrast(tokens['--c-accent'], tokens['--c-accent-ink'])
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      })

      it('keeps the ramp in order, so the hierarchy survives being readable', () => {
        const steps = TEXT.map((token) => contrast(tokens[token], tokens['--c-canvas']))
        const [body, strong, muted, faint] = steps
        expect(strong).toBeGreaterThan(body)
        expect(body).toBeGreaterThan(muted)
        expect(muted).toBeGreaterThan(faint)
      })
    })
  }
})
