'use client'

import { useState, type ReactNode } from 'react'
import { Info as InfoIcon } from 'lucide-react'
import { cn } from '@/lib/cn.ts'

/**
 * The first sentence of a piece of copy, and whatever is left over.
 *
 * Every screen used to open with a paragraph, and every panel with another.
 * The reasoning in them is real and some readers want it, but most want the
 * screen. So the first sentence stays and the rest is one click away.
 */
export function splitSentence(text: string): [string, string] {
  const match = /^(.+?[.?!])\s+(.+)$/s.exec(text.trim())
  return match ? [match[1], match[2]] : [text, '']
}

/** A small "why" that opens in place. Text on demand, not on the page. */
export function Info({ children, label = 'Why' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="no-print">
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'ml-1.5 inline-flex size-4 translate-y-[-1px] items-center justify-center rounded-full align-middle transition-colors',
          open ? 'text-accent' : 'text-faint hover:text-muted'
        )}
      >
        <InfoIcon className="size-3.5" aria-hidden />
      </button>
      {open ? (
        <span
          role="note"
          className="mt-1.5 block max-w-2xl rounded-[var(--radius-control)] border border-line bg-sunken px-3 py-2 text-xs font-normal leading-relaxed text-muted"
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}

/**
 * How wide a view is allowed to be.
 *
 * Every view used to centre itself at whatever width suited it, so clicking
 * down the sidebar moved the heading left and right by up to two hundred
 * pixels a step. The shell now owns the column and the left edge, and a view
 * chooses one of two measures inside it. Only the right edge ever moves, and
 * only between something read and something scanned.
 */
export const MEASURE = {
  /** Tables, grids and side-by-side panels. The whole column. */
  wide: 'w-full',
  /** Anything read a line at a time rather than scanned. */
  read: 'w-full max-w-[52rem]',
} as const

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('panel', className)}>{children}</section>
}

export function Card({
  children,
  className,
  onClick,
  selected,
  severity,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  selected?: boolean
  severity?: string | null
}) {
  const interactive = typeof onClick === 'function'
  return (
    <div
      className={cn(
        'card relative overflow-hidden transition-colors',
        severity && 'sev-edge',
        interactive && 'cursor-pointer hover:border-line-strong',
        selected && 'border-accent ring-1 ring-accent/40',
        className
      )}
      data-sev={severity ?? undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {children}
    </div>
  )
}

/**
 * The heading every view shares: what this is, and the question it answers.
 * The question is not decoration; a category name alone reads as jargon and
 * "Remove one thing. Can the coins still be moved?" does not.
 */
export function ViewHeader({
  eyebrow,
  title,
  question,
  actions,
}: {
  eyebrow?: string
  title: string
  question?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow no-print mb-1">{eyebrow}</p> : null}
        <h1 className="text-[1.35rem] font-semibold tracking-[-0.01em] text-strong">{title}</h1>
        {question ? <Lede text={question} /> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div> : null}
    </header>
  )
}

function Lede({ text }: { text: string }) {
  const [first, rest] = splitSentence(text)
  return (
    <div className="no-print mt-1 max-w-2xl text-sm text-muted">
      {first}
      {rest ? <Info>{rest}</Info> : null}
    </div>
  )
}

export function SectionHeading({
  title,
  hint,
  actions,
}: {
  title: string
  hint?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h2 className="text-[0.95rem] font-semibold text-strong">
          {title}
          {hint ? <Info label={`About ${title.toLowerCase()}`}>{hint}</Info> : null}
        </h2>
      </div>
      {actions ? <div className="flex items-center gap-2 no-print">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string
  body: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="card flex max-w-2xl flex-col items-start gap-3 border-dashed p-6">
      {icon ? <div className="text-faint">{icon}</div> : null}
      <div>
        <h3 className="text-sm font-semibold text-strong">{title}</h3>
        <p className="mt-1 max-w-prose text-sm text-muted">{body}</p>
      </div>
      {action}
    </div>
  )
}

export function Callout({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'accent' | 'warn' | 'danger'
  title?: string
  children: ReactNode
}) {
  const tones = {
    neutral: 'border-line bg-raised',
    accent: 'border-accent/40 bg-accent/[0.06]',
    warn: 'border-medium/40 bg-medium/[0.07]',
    danger: 'border-critical/40 bg-critical/[0.07]',
  }
  return (
    <div className={cn('rounded-[var(--radius-card)] border p-4 text-sm', tones[tone])}>
      {title ? <p className="mb-1 font-semibold text-strong">{title}</p> : null}
      <div className="text-muted prose-tight">{children}</div>
    </div>
  )
}
