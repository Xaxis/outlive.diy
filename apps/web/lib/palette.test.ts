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

/** What `bg-accent/10` actually paints: the accent, at that alpha, over a ground. */
function mix(over: string, under: string, alpha: number): string {
  const channelOf = (hex: string, index: number) =>
    Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
  const parts = [0, 1, 2].map((index) =>
    Math.round(alpha * channelOf(over, index) + (1 - alpha) * channelOf(under, index))
  )
  return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`
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

      it('reads on a selected row, down to the step a selected row may use', () => {
        // The current view in the sidebar and the current world on the map are
        // marked with a tenth of the accent over the surface. That is a ground
        // like any other, and a browser audit only reaches it on the one screen
        // that uses it.
        //
        // The faint step is deliberately not in this list: it clears 4.5:1 on
        // every flat ground and misses it on this one, which is why nothing
        // faint is ever placed on a current row. The rule is here so that a
        // change to the accent cannot quietly take the rest of the ramp with
        // it.
        const ground = mix(tokens['--c-accent'], tokens['--c-surface'], 0.1)
        for (const text of ['--c-body', '--c-strong', '--c-muted']) {
          const ratio = contrast(tokens[text], ground)
          expect(
            ratio,
            `${tokens[text]} on a selected row (${ground}) is ${ratio.toFixed(2)}:1`
          ).toBeGreaterThanOrEqual(4.5)
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
