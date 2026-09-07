'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn.ts'

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
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="text-[1.35rem] font-semibold tracking-[-0.01em] text-strong">{title}</h1>
        {question ? <p className="mt-1 max-w-2xl text-sm text-muted">{question}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div> : null}
    </header>
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
        <h2 className="text-[0.95rem] font-semibold text-strong">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
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
    <div className="card flex flex-col items-start gap-3 border-dashed p-6">
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
