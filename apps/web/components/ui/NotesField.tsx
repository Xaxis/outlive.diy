'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Field, GuardedInput } from '@/components/ui/Field.tsx'

/**
 * Notes, when there are any.
 *
 * Every form in the design steps ended in an empty three-line box that most
 * readers never fill, which on a phone was a screen of nothing at the bottom
 * of every step. Empty, it is a button; written in, or asked for, it is the
 * field, guarded like every other.
 */
export function NotesField({
  value,
  onCommit,
  help,
}: {
  value: string
  onCommit: (value: string) => void
  help?: string
}) {
  const [asked, setAsked] = useState(false)

  if (value.trim() === '' && !asked) {
    return (
      <button
        type="button"
        onClick={() => setAsked(true)}
        className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-strong"
      >
        <Plus className="size-3.5" aria-hidden />
        Add a note
      </button>
    )
  }

  return (
    <Field label="Notes" help={help}>
      <GuardedInput multiline rows={3} value={value} onCommit={onCommit} autoFocus={asked} />
    </Field>
  )
}
