'use client'

import { useState } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import type { Shape } from '@outlive/core'
import { SHAPE_SCHEMA, toShape } from '@/lib/shape-input.ts'
import { Button } from '@/components/ui/Button.tsx'
import { KeyForm } from '@/components/ai/KeyForm.tsx'
import { askClaude, explainError, isBadKey } from '@/lib/ai/client.ts'
import { assertQuestionSendable } from '@/lib/ai/context.ts'
import { forgetClaudeKey, useClaudeKey } from '@/lib/ai/key.ts'

/**
 * Say what you have, and the builder fills itself in.
 *
 * Claude is asked for the builder's own shape, in a strict schema, and the
 * answer is checked and clamped here before it touches anything: a place
 * index that does not exist is dropped, a threshold above the key count is
 * lowered. The reader sees the result in the builder, with the analysis
 * beside it, and nothing is created until they press create.
 */

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
      const answer = await askClaude({
        apiKey: key,
        system: SYSTEM,
        prompt: text,
        schema: SHAPE_SCHEMA,
      })
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
          <KeyForm
            onDone={() => setNeedKey(false)}
            sent="the description you typed above, and nothing from any plan"
          />
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
