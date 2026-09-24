import { Check, LockOpen, Minus, X } from 'lucide-react'
import type { Verdict } from '@outlive/core'

/**
 * How a verdict is shown, in one place.
 *
 * The rail beside the map and the matrix on the overview both paint a verdict
 * per wallet per world, and two tables of what red means is how two screens
 * start disagreeing about the same scenario. Every verdict carries a word and
 * a glyph as well as a colour, because colour alone is not an encoding.
 */
export const VERDICT: Record<
  Verdict,
  { label: string; tone: string; cell: string; icon: typeof Check }
> = {
  safe: {
    label: 'survives',
    tone: 'bg-ok',
    cell: 'border-ok/30 bg-ok/10 text-ok',
    icon: Check,
  },
  degraded: {
    label: 'no spare',
    tone: 'bg-medium',
    cell: 'border-medium/40 bg-medium/12 text-medium',
    icon: Minus,
  },
  lost: {
    label: 'unspendable',
    tone: 'bg-critical',
    cell: 'border-critical/50 bg-critical/15 text-critical',
    icon: X,
  },
  exposed: {
    label: 'they can spend it',
    tone: 'bg-critical',
    cell: 'border-critical bg-critical/25 text-critical',
    icon: LockOpen,
  },
}

export const VERDICT_ORDER: Verdict[] = ['safe', 'degraded', 'lost', 'exposed']
