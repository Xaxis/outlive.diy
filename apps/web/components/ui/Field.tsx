'use client'

import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react'
import { inspect, type GuardHit } from '@outlive/core'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/cn.ts'

/**
 * The id of the label a field is wrapping, so that whatever control ends up
 * inside can name itself from it.
 *
 * Passing `htmlFor` down would work for a single input and break for the
 * several fields here that hold a group of chips or a control plus a shortcut
 * row. Naming by reference works for all of them, and means a control is never
 * left unlabelled because of how its field happened to be composed.
 */
const FieldLabelContext = createContext<string | undefined>(undefined)

export function useFieldLabel(): string | undefined {
  return useContext(FieldLabelContext)
}

export function Field({
  label,
  help,
  children,
  className,
}: {
  label: string
  help?: string
  children: ReactNode
  className?: string
}) {
  const labelId = useId()
  return (
    <FieldLabelContext value={labelId}>
      <div className={cn('space-y-1.5', className)}>
        <span className="label" id={labelId}>
          {label}
        </span>
        {children}
        {help ? <p className="text-xs leading-snug text-faint">{help}</p> : null}
      </div>
    </FieldLabelContext>
  )
}

/**
 * A text field that will not hold key material.
 *
 * Typing is never blocked, because a field that fights the keyboard is a field
 * people paste into somewhere else. What is blocked is *storage*: while the
 * value is refused it is shown, explained, and not committed, and leaving the
 * field puts back the last value that was allowed. The explanation names what
 * was recognised without repeating it.
 */
export function GuardedInput({
  value,
  onCommit,
  multiline,
  placeholder,
  id,
  rows,
  ariaLabel,
}: {
  value: string
  onCommit: (next: string) => void
  multiline?: boolean
  placeholder?: string
  id?: string
  rows?: number
  /** For the fields that stand outside a Field, such as a row's own name. */
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState(value)
  const [hits, setHits] = useState<GuardHit[]>([])
  const [committed, setCommitted] = useState(value)
  // What the field held before this editing run started.
  //
  // A field that saves as you type commits the longest thing the guard was
  // willing to accept, and while somebody types a seed word by word that is a
  // partial seed. The guard refuses the whole once enough of it exists, and
  // this is what makes the refusal undo the part that was already stored
  // rather than leaving five words of twelve behind.
  const baseline = useRef(value)
  const fallbackId = useId()
  const labelledBy = useFieldLabel()
  const fieldId = id ?? fallbackId

  // The committed value can change underneath this field: an undo, a plan
  // switch, a change made elsewhere. Resetting during render is React's own
  // answer to that, and avoids the extra pass an effect would cost.
  //
  // Our own commit arriving back is not somebody else changing the field, and
  // treating it as one wiped every warning in the same pass that allowed it: a
  // warn commits, the commit lands as a new value, the hits are cleared, and
  // the notice the guard wrote never paints. That made every warn-strength hit
  // in the program invisible, including the ones about a street address or a
  // person's name, which are the ones this app most needs to say out loud.
  // Comparing against the draft tells the two apart: what we committed is what
  // is already in the box.
  if (committed !== value) {
    setCommitted(value)
    if (value !== draft) {
      setDraft(value)
      setHits([])
    }
  }

  const handle = (next: string) => {
    setDraft(next)
    const result = inspect(next)
    setHits(result.hits)
    if (result.ok) onCommit(next)
  }

  const refusal = hits.find((hit) => hit.strength === 'refuse')
  const warning = hits.find((hit) => hit.strength === 'warn')
  const Tag = multiline ? 'textarea' : 'input'

  return (
    <div className="space-y-1.5">
      <Tag
        id={fieldId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : labelledBy}
        className={cn(
          multiline ? 'textarea' : 'input',
          refusal && 'border-critical bg-critical/[0.06]'
        )}
        value={draft}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={refusal ? true : undefined}
        aria-describedby={refusal ? `${fieldId}-guard` : undefined}
        onChange={(event) => handle(event.target.value)}
        onFocus={() => {
          baseline.current = value
        }}
        onBlur={() => {
          if (!refusal) return
          setDraft(baseline.current)
          setHits([])
          // On blur rather than on the keystroke that refused, because putting
          // the stored value back mid-keystroke would reset the draft under
          // the reader and take away what they are looking at.
          if (value !== baseline.current) onCommit(baseline.current)
        }}
      />
      {refusal ? (
        <p
          id={`${fieldId}-guard`}
          role="alert"
          className="flex gap-2 rounded-[var(--radius-control)] border border-critical/40 bg-critical/[0.07] p-2 text-xs leading-snug text-body"
        >
          <ShieldAlert className="mt-0.5 size-4 flex-none text-critical" aria-hidden />
          <span>
            <strong className="font-semibold text-critical">Not stored: {refusal.found}.</strong>{' '}
            {refusal.reason} {refusal.instead}
          </span>
        </p>
      ) : warning ? (
        <p className="flex gap-2 text-xs leading-snug text-muted">
          <AlertTriangle className="mt-0.5 size-3.5 flex-none text-medium" aria-hidden />
          <span>
            {warning.reason} {warning.instead}
          </span>
        </p>
      ) : null}
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  id,
  placeholder,
}: {
  value: T | null
  onChange: (next: T | null) => void
  options: { value: T; label: string }[]
  id?: string
  placeholder?: string
}) {
  const labelledBy = useFieldLabel()
  return (
    <select
      id={id}
      aria-labelledby={labelledBy}
      className="select"
      value={value ?? ''}
      onChange={(event) => onChange((event.target.value || null) as T | null)}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/**
 * A number with the answers that mean something offered beside it.
 *
 * "How often" and "how long until" were number boxes with a sentence of help
 * underneath, which is the shape that produces round numbers nobody meant: 365
 * gets typed because it is a year, not because a year was decided. Naming the
 * intervals makes the decision the thing you pick. The box stays, because the
 * answer is sometimes genuinely 45 days and a control that cannot say so is a
 * control that gets lied to.
 */
export function PresetNumber({
  value,
  onChange,
  presets,
  suffix,
  max,
  nullable,
}: {
  value: number | null
  onChange: (next: number | null) => void
  presets: { value: number; label: string }[]
  suffix?: string
  max?: number
  nullable?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const on = value === preset.value
          return (
            <button
              key={preset.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(preset.value)}
              className={cn(
                'chip transition-colors',
                on
                  ? 'border-accent/60 bg-accent/10 text-strong'
                  : 'hover:border-line-strong hover:text-body'
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      <NumberInput
        value={value}
        onChange={onChange}
        max={max}
        suffix={suffix}
        nullable={nullable}
      />
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 100000,
  suffix,
  id,
  nullable,
}: {
  value: number | null
  onChange: (next: number | null) => void
  min?: number
  max?: number
  suffix?: string
  id?: string
  nullable?: boolean
}) {
  const labelledBy = useFieldLabel()
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        aria-labelledby={labelledBy}
        type="number"
        inputMode="numeric"
        className="input max-w-[8rem]"
        min={min}
        max={max}
        value={value ?? ''}
        placeholder={nullable ? 'unknown' : undefined}
        onChange={(event) => {
          const raw = event.target.value
          if (raw === '') {
            onChange(nullable ? null : min)
            return
          }
          const parsed = Number(raw)
          if (Number.isNaN(parsed)) return
          onChange(Math.min(max, Math.max(min, Math.round(parsed))))
        }}
      />
      {suffix ? <span className="text-xs text-faint">{suffix}</span> : null}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  help?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 h-[1.1rem] w-8 flex-none rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-sunken'
        )}
      >
        <span
          className={cn(
            'block size-3 rounded-full transition-transform',
            checked
              ? 'translate-x-[1.05rem] bg-[var(--c-accent-ink)]'
              : 'translate-x-[0.15rem] bg-faint'
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm text-body">{label}</span>
        {help ? <span className="block text-xs leading-snug text-faint">{help}</span> : null}
      </span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string; hint?: string }[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-[var(--radius-control)] border border-line-strong bg-sunken p-0.5',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.hint}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-raised text-strong shadow-[0_1px_0_0_rgb(var(--tint)/0.06)_inset]'
              : 'text-muted hover:text-strong'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * One question, answered by picking a sentence rather than typing a number.
 *
 * The consequence is written on the option itself. That is the whole reason
 * this exists: "30" in a box marked "days" asks the reader to work out for
 * themselves what thirty days would mean, and most people do not, so they pick
 * a round number and the analysis is then measured against a number nobody
 * meant. An option that says what it commits you to is answered on purpose.
 */
export function ChoiceGroup<T extends string | number>({
  value,
  onChange,
  options,
  name,
}: {
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string; consequence: string }[]
  /** Groups the radios, so arrow keys move between them and nowhere else. */
  name: string
}) {
  return (
    <div role="radiogroup" aria-labelledby={useFieldLabel()} className="grid gap-1.5">
      {options.map((option) => {
        const checked = option.value === value
        return (
          <label
            key={String(option.value)}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border p-2.5 transition-colors',
              checked
                ? 'border-accent bg-accent/[0.07]'
                : 'border-line hover:border-line-strong hover:bg-[rgb(var(--tint)/0.02)]'
            )}
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'mt-[0.2rem] size-3.5 flex-none rounded-full border',
                checked ? 'border-[5px] border-accent bg-canvas' : 'border-line-strong'
              )}
            />
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[0.8125rem] font-medium',
                  checked ? 'text-strong' : 'text-body'
                )}
              >
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">
                {option.consequence}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** Multi-select over a small fixed set, as toggleable chips. */
export function ChipSet<T extends string>({
  values,
  onChange,
  options,
}: {
  values: T[]
  onChange: (next: T[]) => void
  options: { value: T; label: string }[]
}) {
  const labelledBy = useFieldLabel()
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = values.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onChange(
                active
                  ? values.filter((entry) => entry !== option.value)
                  : [...values, option.value]
              )
            }
            className={cn(
              'chip transition-colors',
              active
                ? 'border-accent/60 bg-accent/10 text-strong'
                : 'hover:border-line-strong hover:text-body'
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
