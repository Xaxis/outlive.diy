'use client'

import { useId, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { GuardedInput } from '@/components/ui/Field.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * Pick from a list or type your own.
 *
 * A dropdown alone cannot hold the device nobody put on the list, and a text
 * box alone gets "Trezor", "trezor" and "Trezor " as three makers, which the
 * analysis then counts as three. So this is both: the list filters as you
 * type, a pick fills the field, and whatever you type that is not on the list
 * is kept as typed. Typed text goes through the guard like every other field.
 */
export function Combo({
  value,
  options,
  onCommit,
  onPick,
  placeholder,
  ariaLabel,
}: {
  value: string
  options: { value: string; hint?: string }[]
  /** Every change to the text, as typed. */
  onCommit: (next: string) => void
  /** A choice from the list, which may do more than set the text. */
  onPick?: (next: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)

  const typed = (query ?? '').trim().toLowerCase()
  // While the field still holds what was picked, show everything: opening the
  // list to change your mind should not show only the one you already have.
  const shown =
    query === null || typed === ''
      ? options
      : options.filter((option) => option.value.toLowerCase().includes(typed))
  const active = Math.min(cursor, Math.max(0, shown.length - 1))

  const pick = (next: string) => {
    ;(onPick ?? onCommit)(next)
    setQuery(null)
    setOpen(false)
  }

  return (
    <div className="relative">
      <GuardedInput
        value={value}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        onCommit={onCommit}
        combo={{
          onDraft: (text) => {
            setQuery(text)
            setOpen(true)
            setCursor(0)
          },
          // Selected on focus, so typing replaces the name rather than
          // appending to it, and the whole list is offered.
          onFocus: (event) => {
            event.target.select()
            setQuery(null)
            setOpen(true)
          },
          // After a click on an option has landed, which a blur would pre-empt.
          onBlur: () => window.setTimeout(() => setOpen(false), 120),
          onKeyDown: (event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setCursor(Math.min(shown.length - 1, active + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setCursor(Math.max(0, active - 1))
            } else if (event.key === 'Enter' && open && shown[active]) {
              event.preventDefault()
              pick(shown[active].value)
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          },
          attributes: {
            role: 'combobox',
            'aria-expanded': open && shown.length > 0,
            'aria-controls': `${id}-list`,
            'aria-autocomplete': 'list',
            'aria-activedescendant': open && shown[active] ? `${id}-${active}` : undefined,
            autoComplete: 'off',
          },
          className: 'pr-8',
        }}
      />
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-[0.7rem] size-3.5 text-faint"
        aria-hidden
      />
      {open && shown.length > 0 ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="panel absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto p-1"
        >
          {shown.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                // Before the input blurs, so the pick is not lost to it.
                event.preventDefault()
                pick(option.value)
              }}
              onMouseMove={() => setCursor(index)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-sm',
                index === active ? 'bg-accent/10 text-strong' : 'text-body'
              )}
            >
              <Check
                className={cn(
                  'size-3.5 flex-none text-accent',
                  option.value.toLowerCase() === value.trim().toLowerCase() ? '' : 'opacity-0'
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{option.value}</span>
              {option.hint ? (
                <span className="flex-none text-[0.6875rem] text-faint">{option.hint}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
