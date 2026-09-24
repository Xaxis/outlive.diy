'use client'

import { useId, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button.tsx'
import { setClaudeKey } from '@/lib/ai/key.ts'

/**
 * Where the reader puts their Anthropic key, and what they are told first.
 *
 * A password field, not a guarded one: the key is not part of the plan, is
 * never stored with it, and the guard would rightly object to a long random
 * string. It says where the key goes and what goes with it before it is
 * accepted, because this is the one switch that makes the program talk to
 * something.
 */
export function KeyForm({ onDone }: { onDone?: () => void }) {
  const id = useId()
  const [value, setValue] = useState('')
  const [remember, setRemember] = useState(false)

  return (
    <form
      className="space-y-2.5 rounded-[var(--radius-control)] border border-line bg-sunken p-3 text-xs text-muted"
      onSubmit={(event) => {
        event.preventDefault()
        if (!value.trim()) return
        setClaudeKey(value, remember)
        setValue('')
        onDone?.()
      }}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-strong">
        <KeyRound className="size-4 text-accent" aria-hidden />
        Use your own Anthropic API key
      </p>
      <ul className="list-disc space-y-0.5 pl-4 leading-relaxed">
        <li>Requests go from this browser straight to Anthropic, and nowhere else.</li>
        <li>
          Sent: your plan&apos;s structure and its findings, with every note removed. Never a seed,
          key or address; the guard checks the request before it leaves.
        </li>
        <li>You pay Anthropic for what you use, on your own account.</li>
      </ul>
      <label htmlFor={id} className="sr-only">
        Anthropic API key
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="input min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" size="sm" disabled={!value.trim()}>
          Use this key
        </Button>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        Remember it in this browser. Otherwise it is forgotten when the tab closes.
      </label>
    </form>
  )
}
