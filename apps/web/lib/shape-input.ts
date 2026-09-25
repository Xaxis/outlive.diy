import { PLACE_DEFAULTS, spreadPlacement, type LocationKind, type Shape } from '@outlive/core'
import { LOCATION_KIND } from '@/lib/describe.ts'

/**
 * A plan's shape, as it arrives from outside: from Claude describing a
 * sentence, or from an agent in the browser calling a tool. Either way it is
 * untrusted JSON, so it is described by one schema and made safe by one
 * function, which checks every index and bounds every count before the
 * builder or the store sees it.
 */

const KINDS = Object.keys(LOCATION_KIND) as LocationKind[]

export const SHAPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'threshold',
    'keys',
    'collaborative',
    'hotWallet',
    'places',
    'placement',
    'configPlaces',
    'successorPlaces',
    'assumptions',
  ],
  properties: {
    threshold: { type: 'integer' },
    keys: { type: 'integer' },
    collaborative: { type: 'boolean' },
    hotWallet: { type: 'boolean' },
    places: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'travelMinutes', 'far'],
        properties: {
          kind: { type: 'string', enum: KINDS },
          travelMinutes: { type: 'integer' },
          far: { type: 'boolean' },
        },
      },
    },
    placement: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['device', 'backup'],
        properties: { device: { type: 'integer' }, backup: { type: 'integer' } },
      },
    },
    configPlaces: { type: 'array', items: { type: 'integer' } },
    successorPlaces: { type: 'array', items: { type: 'integer' } },
    assumptions: { type: 'string' },
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** The answer, made safe to use: every index checked, every count bounded. */
export function toShape(raw: unknown, current: Shape): { shape: Shape; assumptions: string } {
  const data = raw as Record<string, unknown>
  const places = (Array.isArray(data.places) ? data.places : []).slice(0, 8).map((entry) => {
    const place = entry as { kind?: string; travelMinutes?: number; far?: boolean }
    const kind = KINDS.includes(place.kind as LocationKind) ? (place.kind as LocationKind) : 'other'
    return {
      kind,
      travelMinutes: clamp(
        Number(place.travelMinutes ?? PLACE_DEFAULTS[kind].travelMinutes),
        0,
        10080
      ),
      far: Boolean(place.far),
    }
  })
  const usable = places.length > 0 ? places : current.places
  const keys = clamp(Number(data.keys ?? 1), 1, 9)
  const threshold = clamp(Number(data.threshold ?? 1), 1, keys)
  const collaborative = Boolean(data.collaborative) && keys > 1
  const index = (value: unknown) => {
    const number = Number(value)
    return Number.isInteger(number) && number >= 0 && number < usable.length ? number : null
  }
  const given = Array.isArray(data.placement) ? data.placement : []
  const placement =
    given.length === keys
      ? given.map((entry) => {
          const pair = entry as { device?: unknown; backup?: unknown }
          return { device: index(pair.device), backup: index(pair.backup) }
        })
      : spreadPlacement(keys, usable.length, collaborative)
  const indexes = (value: unknown) =>
    [...new Set((Array.isArray(value) ? value : []).map(index))].filter(
      (entry): entry is number => entry !== null
    )
  return {
    shape: {
      ...current,
      threshold,
      keys,
      collaborative,
      hotWallet: Boolean(data.hotWallet),
      places: usable,
      placement,
      configPlaces: keys > 1 ? indexes(data.configPlaces) : [],
      successorPlaces: indexes(data.successorPlaces),
    },
    assumptions: typeof data.assumptions === 'string' ? data.assumptions.slice(0, 400) : '',
  }
}
