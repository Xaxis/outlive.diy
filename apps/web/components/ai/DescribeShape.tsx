'use client'

import { useState } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { spreadPlacement, PLACE_DEFAULTS, type LocationKind, type Shape } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { KeyForm } from '@/components/ai/KeyForm.tsx'
import { askClaude, explainError, isBadKey } from '@/lib/ai/client.ts'
import { assertQuestionSendable } from '@/lib/ai/context.ts'
import { forgetClaudeKey, useClaudeKey } from '@/lib/ai/key.ts'
import { LOCATION_KIND } from '@/lib/describe.ts'

/**
 * Say what you have, and the builder fills itself in.
 *
 * Claude is asked for the builder's own shape, in a strict schema, and the
 * answer is checked and clamped here before it touches anything: a place
 * index that does not exist is dropped, a threshold above the key count is
 * lowered. The reader sees the result in the builder, with the analysis
 * beside it, and nothing is created until they press create.
 */

const KINDS = Object.keys(LOCATION_KIND) as LocationKind[]

const SCHEMA = {
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

const SYSTEM = `You turn a plain description of a Bitcoin self-custody setup into the shape outlive.diy's plan builder uses. Return only the JSON the schema asks for.

- keys: how many signing keys; threshold: how many are needed to spend (1 for a single key).
- collaborative: true when one key is held by a company or cosigning service; that key is the last one.
- places: every place something is kept, in order. kind is one of the enum values. travelMinutes: door to door from where they usually are (0 for home). far: true when it is in another city or region from home.
- placement: one entry per key, in order: the index into places of its signing device, and of its backup. Use -1 when there is none, and -1 for both on a key a service holds.
- configPlaces: indexes of places holding a copy of the multisig wallet configuration (descriptor); empty for a single key.
- successorPlaces: indexes of places an heir can open after the owner's death; empty if none is described.
- hotWallet: true only if they describe a separate small spending wallet on a phone.
- assumptions: one short sentence naming anything you had to guess.

Places are roles, never addresses or names. If the description contains seed words, keys or addresses, ignore them and say so in assumptions.`

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

export function DescribeShape({
  shape,
  onShape,
}: {
  shape: Shape
  onShape: (next: Shape) => void
}) {
  const { key } = useClaudeKey()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needKey, setNeedKey] = useState(false)

  const run = async () => {
    setError(null)
    setNote(null)
    if (!key) {
      setNeedKey(true)
      return
    }
    try {
      assertQuestionSendable(text)
    } catch (refused) {
      setError(explainError(refused))
      return
    }
    setBusy(true)
    try {
      const answer = await askClaude({ apiKey: key, system: SYSTEM, prompt: text, schema: SCHEMA })
      const result = toShape(JSON.parse(answer), shape)
      onShape(result.shape)
      setNote(result.assumptions || 'Filled in from your description. Check it below.')
    } catch (failure) {
      setError(explainError(failure))
      if (isBadKey(failure)) {
        forgetClaudeKey()
        setNeedKey(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="no-print">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          if (text.trim()) void run()
        }}
      >
        <textarea
          aria-label="Describe your setup"
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. 2 of 3: a Coldcard at home with its plate, one at my sister's in another city, one in a bank box; my son inherits"
          className="textarea min-w-0 flex-1 text-sm"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !text.trim()}
          icon={
            busy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )
          }
        >
          {busy ? 'Reading…' : 'Fill it in'}
        </Button>
      </form>
      <p className="mt-1 text-[0.6875rem] text-faint">
        With your Anthropic key. Use roles, not addresses or names. Never type seed words here.
      </p>
      {needKey && !key ? (
        <div className="mt-2">
          <KeyForm onDone={() => setNeedKey(false)} />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-critical">
          {error}
        </p>
      ) : null}
      {note ? <p className="mt-2 text-xs text-muted">Claude: {note}</p> : null}
    </div>
  )
}
