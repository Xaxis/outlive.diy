'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Network, Wrench } from 'lucide-react'
import { CATEGORY_LABEL, RULES, type Finding, type Ref } from '@outlive/core'
import { SeverityDot, SEVERITY_LABEL } from '@/components/ui/Severity.tsx'
import { navigateTo } from '@/lib/router.ts'
import { cn } from '@/lib/cn.ts'

/** Where an entity is edited, so a finding can send you to the thing it is about. */
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
  const article = useRef<HTMLElement>(null)

  // Arriving from a link to one particular finding, in a list of twenty-three.
  useEffect(() => {
    if (!defaultOpen) return
    // Optional call: not every environment this renders in implements it,
    // and failing to scroll is never worth throwing over.
    article.current?.scrollIntoView?.({ block: 'center', behavior: 'auto' })
  }, [defaultOpen])

  return (
    <article ref={article} data-sev={finding.severity} className="card sev-edge print-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left"
      >
        <SeverityDot severity={finding.severity} className="mt-[0.45rem]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.875rem] font-medium leading-snug text-strong">
            {finding.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-faint">
            <span className="mono">{finding.rule}</span>
            <span aria-hidden>·</span>
            {/* Named, not only coloured. A dot is no encoding at all on a mono
                printer or to a reader who cannot separate red from orange. */}
            <span data-sev={finding.severity} className="sev-text font-medium">
              {SEVERITY_LABEL[finding.severity]}
            </span>
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

        {/* A finding names what breaks. The map draws where it breaks, in the
            same world this came out of, and getting between the two should not
            be a search through a dropdown of twenty scenarios. */}
        {finding.scenarioId ? (
          <button
            type="button"
            onClick={() => navigateTo('map', finding.scenarioId)}
            className="no-print mt-3 inline-flex items-center gap-1.5 text-[0.75rem] text-accent underline underline-offset-2"
          >
            <Network className="size-3.5" aria-hidden />
            Draw this on the map
          </button>
        ) : null}

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
