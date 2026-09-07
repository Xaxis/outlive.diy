'use client'

import { useState } from 'react'
import { ChevronRight, Wrench } from 'lucide-react'
import { CATEGORY_LABEL, RULES, type Finding, type Ref } from '@outlive/core'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { cn } from '@/lib/cn.ts'

/** Where an entity is edited, so a finding can send you to the thing it is about. */
export const SUBJECT_SECTION: Record<string, string> = {
  location: 'locations',
  person: 'people',
  device: 'devices',
  key: 'keys',
  wallet: 'wallets',
  backup: 'keys',
  path: 'wallets',
  verification: 'checks',
  plan: 'profile',
}

export function FindingCard({
  finding,
  labelOf,
  onOpenSubject,
  defaultOpen,
}: {
  finding: Finding
  labelOf: (ref: Ref) => string | null
  onOpenSubject: (ref: Ref) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const rule = RULES[finding.rule]

  return (
    <article data-sev={finding.severity} className="card sev-edge print-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-3.5 text-left"
      >
        <SeverityDot severity={finding.severity} className="mt-[0.45rem]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.875rem] font-medium leading-snug text-strong">
            {finding.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-faint">
            <span className="mono">{finding.rule}</span>
            <span aria-hidden>·</span>
            <span>{CATEGORY_LABEL[finding.category]}</span>
            {finding.world ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{finding.world}</span>
              </>
            ) : null}
          </span>
        </span>
        <ChevronRight
          className={cn(
            'no-print mt-1 size-4 flex-none text-faint transition-transform',
            open && 'rotate-90'
          )}
          aria-hidden
        />
      </button>

      {/* Always rendered, hidden when collapsed on screen. A printed findings
          list with everything folded away is a list of headlines, and the
          remediation is the part worth carrying to a desk. */}
      <div
        className={cn(
          'border-t border-line px-3.5 py-3 text-[0.8125rem] leading-relaxed',
          !open && 'hidden print:block'
        )}
      >
        <p className="text-body">{finding.detail}</p>

        <div className="mt-3 flex gap-2.5 rounded-[var(--radius-control)] border border-line bg-sunken p-3">
          <Wrench className="mt-0.5 size-3.5 flex-none text-accent" aria-hidden />
          <p className="text-body">{finding.remediation}</p>
        </div>

        {finding.subjects.length > 0 ? (
          <div className="no-print mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[0.6875rem] uppercase tracking-wider text-faint">About</span>
            {finding.subjects.map((subject) => {
              const label = labelOf(subject)
              if (!label) return null
              return (
                <button
                  key={`${subject.type}:${subject.id}`}
                  type="button"
                  className="chip transition-colors hover:border-accent hover:text-strong"
                  onClick={() => onOpenSubject(subject)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}

        <p className="mt-3 border-t border-line pt-2.5 text-[0.75rem] leading-relaxed text-faint">
          <span className="mono">{rule.id}</span> looks for: {rule.looksFor.toLowerCase()}.{' '}
          {rule.because}
        </p>
      </div>
    </article>
  )
}
