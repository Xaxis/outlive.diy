import { describe, expect, it } from 'vitest'
import { analyze, defaultShape, exampleById } from '@outlive/core'
import { assertQuestionSendable, planContext, RefusedToSend } from './context.ts'
import { toShape } from '@/components/ai/DescribeShape.tsx'

describe('what leaves the browser when Claude is asked', () => {
  it('carries structure and findings, and no notes', () => {
    const plan = exampleById('two-of-three')!
    plan.locations[0].notes = 'the flat above the bakery on the high street'
    plan.keys[0].notes = 'remember to check the plate'
    const sent = JSON.stringify(planContext(plan, analyze(plan)))
    expect(sent).not.toContain('bakery')
    expect(sent).not.toContain('check the plate')
    expect(sent).toContain('Site A')
    expect(sent).toContain('L001')
  })

  it('sends nothing at all if anything in it is key material', () => {
    const plan = exampleById('two-of-three')!
    plan.locations[0].label =
      'abandon ability able about above absent absorb abstract absurd abuse access accident'
    expect(() => planContext(plan, null)).toThrow(RefusedToSend)
  })

  it('refuses a question that is a seed', () => {
    expect(() =>
      assertQuestionSendable(
        'is this ok: abandon ability able about above absent absorb abstract absurd abuse access accident'
      )
    ).toThrow(RefusedToSend)
    expect(() => assertQuestionSendable('what should I do first?')).not.toThrow()
  })
})

describe('an answer turned into a shape', () => {
  it('checks every index and bounds every count before it is used', () => {
    const { shape } = toShape(
      {
        threshold: 9,
        keys: 3,
        collaborative: false,
        hotWallet: false,
        places: [
          { kind: 'home', travelMinutes: 0, far: false },
          { kind: 'not-a-kind', travelMinutes: -40, far: true },
        ],
        placement: [
          { device: 0, backup: 1 },
          { device: 7, backup: -1 },
          { device: 1, backup: 1 },
        ],
        configPlaces: [0, 1, 5, 1],
        successorPlaces: [-1, 1],
        assumptions: 'guessed the travel',
      },
      defaultShape()
    )
    expect(shape.threshold).toBe(3)
    expect(shape.places[1].kind).toBe('other')
    expect(shape.places[1].travelMinutes).toBe(0)
    expect(shape.placement[1]).toEqual({ device: null, backup: null })
    expect(shape.configPlaces).toEqual([0, 1])
    expect(shape.successorPlaces).toEqual([1])
  })
})
