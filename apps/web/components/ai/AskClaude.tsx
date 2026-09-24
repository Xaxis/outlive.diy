'use client'

import { useRef, useState } from 'react'
import { LoaderCircle, Sparkles, Square } from 'lucide-react'
import type { Plan } from '@outlive/core'
import { reportFor } from '@/lib/analysis.ts'
import { Button } from '@/components/ui/Button.tsx'
import { Disclosure } from '@/components/ui/Disclosure.tsx'
import { Markdown } from '@/components/ai/Markdown.tsx'
import { KeyForm } from '@/components/ai/KeyForm.tsx'
import { askClaude, explainError, isBadKey } from '@/lib/ai/client.ts'
import { assertQuestionSendable, planContext, SYSTEM } from '@/lib/ai/context.ts'
import { forgetClaudeKey, useClaudeKey } from '@/lib/ai/key.ts'
import { cn } from '@/lib/cn.ts'

/**
 * One question to Claude about this plan, answered where it was asked.
 *
 * Nothing is sent until the button is pressed, and the button says Claude.
 * The first press with no key asks for one, in place. The payload is shown on
 * request, exactly as it goes. The answer streams in and can be stopped.
 */
export function AskClaude({
  plan,
  question,
  label = 'Ask Claude',
  suggestions,
  freeText = false,
  className,
}: {
  plan: Plan
  /** The fixed question, for a button that asks one thing. */
  question?: string
  label?: string
  /** One-click questions offered beside a free-text box. */
  suggestions?: string[]
  freeText?: boolean
  className?: string
}) {
  const { key } = useClaudeKey()
  const [asking, setAsking] = useState(false)
  const [needKey, setNeedKey] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const ask = async (text: string) => {
    setError(null)
    if (!key) {
      setNeedKey(true)
      return
    }
    let prompt: string
    try {
      assertQuestionSendable(text)
      const context = planContext(plan, reportFor(plan))
      prompt = `Here is my plan and what the analysis found, as JSON:\n\n${JSON.stringify(context)}\n\nMy question: ${text}`
    } catch (refused) {
      setError(explainError(refused))
      return
    }
    setSent(prompt)
    setAnswer('')
    setAsking(true)
    abort.current = new AbortController()
    try {
      await askClaude({
        apiKey: key,
        system: SYSTEM,
        prompt,
        signal: abort.current.signal,
        onText: (delta) => setAnswer((current) => current + delta),
      })
    } catch (failure) {
      setError(explainError(failure))
      if (isBadKey(failure)) {
        forgetClaudeKey()
        setNeedKey(true)
      }
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className={cn('no-print', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {question ? (
          <Button
            size="sm"
            disabled={asking}
            onClick={() => void ask(question)}
            icon={
              asking ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3.5 text-accent" aria-hidden />
              )
            }
          >
            {label}
          </Button>
        ) : null}
        {suggestions?.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={asking}
            onClick={() => void ask(suggestion)}
            className="chip gap-1 hover:border-accent hover:text-strong disabled:opacity-50"
          >
            <Sparkles className="size-3 text-accent" aria-hidden />
            {suggestion}
          </button>
        ))}
        {asking ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => abort.current?.abort()}
            icon={<Square className="size-3" aria-hidden />}
          >
            Stop
          </Button>
        ) : null}
      </div>

      {freeText ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (typed.trim()) void ask(typed.trim())
          }}
        >
          <input
            aria-label="Ask Claude about this plan"
            placeholder="Ask anything about this plan…"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="input min-w-0 flex-1"
          />
          <Button type="submit" variant="primary" disabled={asking || !typed.trim()}>
            Ask
          </Button>
        </form>
      ) : null}

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

      {answer || asking ? (
        <div
          aria-live="polite"
          className="mt-2 rounded-[var(--radius-control)] border border-accent/30 bg-accent/[0.04] p-3"
        >
          {answer ? (
            <Markdown text={answer} />
          ) : (
            <p className="text-xs text-faint">Claude is reading the plan…</p>
          )}
          <p className="mt-2 border-t border-line pt-1.5 text-[0.6875rem] text-faint">
            From Claude, not from this program&apos;s rules. Check it against the findings.
          </p>
        </div>
      ) : null}

      {sent ? (
        <Disclosure size="aside" title="Exactly what was sent" className="mt-1.5">
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-sunken p-2 text-[0.6875rem] text-muted">
            {sent}
          </pre>
        </Disclosure>
      ) : null}
    </div>
  )
}
