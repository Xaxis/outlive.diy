'use client'

import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn.ts'

/**
 * A section that is worth having and not worth reading twice.
 *
 * Three things on these pages are like that: the quorum arithmetic under the
 * map, the composer under the stress test, and the note explaining what the
 * drawing means. Each is genuinely useful and each was permanently open, which
 * made the page that carries it look like four things instead of one.
 *
 * Closed by default and never on its own line of chrome: the heading is the
 * control, so nothing is spent on a row that only says "expand".
 */
export function Disclosure({
  title,
  hint,
  children,
  className,
  size = 'section',
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
  /** A page section, or a quiet aside inside a panel. */
  size?: 'section' | 'aside'
}) {
  const [open, setOpen] = useState(false)
  const section = size === 'section'

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="group flex w-full items-start gap-2 text-left no-print"
      >
        <ChevronRight
          className={cn(
            'flex-none text-faint transition-transform',
            section ? 'mt-0.5 size-4' : 'mt-[0.15rem] size-3.5',
            open && 'rotate-90'
          )}
          aria-hidden
        />
        <span className="min-w-0">
          <span
            className={cn(
              'block transition-colors group-hover:text-strong',
              section
                ? 'text-[0.95rem] font-semibold text-strong'
                : 'text-xs font-medium text-muted'
            )}
          >
            {title}
          </span>
          {hint ? <span className="block text-xs text-faint">{hint}</span> : null}
        </span>
      </button>

      {/* Kept mounted, so that nothing typed into a composer is lost by folding
          it away. Not forced open for print: what the reader folded away is
          what they meant to fold away, and the chevron that opens it does not
          print. */}
      <div hidden={!open} className={section ? 'mt-3' : 'mt-2'}>
        {children}
      </div>
    </div>
  )
}
