'use client'

import { useMemo, useState } from 'react'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_QUESTION,
  indexPlan,
  type FindingCategory,
  type Ref,
  type Severity,
} from '@outlive/core'
import { Printer } from 'lucide-react'
import { ViewHeader } from '@/components/ui/Surface.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { SeverityBar } from '@/components/ui/Severity.tsx'
import { FindingCard, SUBJECT_SECTION } from '@/components/findings/FindingCard.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useReport } from '@/lib/analysis.ts'
import { useRoute } from '@/lib/router.ts'
import { cn } from '@/lib/cn.ts'

export function FindingsView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const select = useStore((state) => state.select)
  const [, navigate] = useRoute()
  const [severity, setSeverity] = useState<Severity | null>(null)
  const [category, setCategory] = useState<FindingCategory | null>(null)

  const index = useMemo(() => (plan ? indexPlan(plan) : null), [plan])
  if (!plan || !report || !index) return null

  const labelOf = (ref: Ref): string | null => {
    switch (ref.type) {
      case 'location':
        return index.locations.get(ref.id)?.label ?? null
      case 'person':
        return index.people.get(ref.id)?.label ?? null
      case 'device':
        return index.devices.get(ref.id)?.label ?? null
      case 'key':
        return index.keys.get(ref.id)?.label ?? null
      case 'wallet':
        return index.wallets.get(ref.id)?.label ?? null
      case 'backup': {
        const found = index.backups.get(ref.id)
        return found ? `${found.key.label} / ${found.backup.label}` : null
      }
      case 'plan':
        return 'The plan overall'
      default:
        return null
    }
  }

  const openSubject = (ref: Ref) => {
    select(ref)
    navigate({ view: 'design', section: SUBJECT_SECTION[ref.type] ?? 'profile' })
  }

  const visible = report.findings.filter(
    (finding) =>
      (severity === null || finding.severity === severity) &&
      (category === null || finding.category === category)
  )

  const presentCategories = CATEGORY_ORDER.filter((entry) =>
    report.findings.some((finding) => finding.category === entry)
  )

  return (
    <div className="mx-auto max-w-4xl">
      <ViewHeader
        eyebrow="Diagnosis"
        title="Findings"
        question="Ranked worst first, each with one thing to do about it. There is no score, because a custody plan that gets a B is not a thing."
        actions={
          <Button
            variant="default"
            onClick={() => window.print()}
            icon={<Printer className="size-3.5" aria-hidden />}
          >
            Print
          </Button>
        }
      />

      {report.brokenReferences.length > 0 ? (
        <div className="mb-5 rounded-[var(--radius-card)] border border-critical/40 bg-critical/[0.07] p-4 text-sm">
          <p className="font-semibold text-strong">
            This plan file has references that point at nothing
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted">
            {report.brokenReferences.slice(0, 6).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-5 space-y-3">
        <SeverityBar counts={report.counts} onSelect={setSeverity} selected={severity} />
        {presentCategories.length > 1 ? (
          <div className="flex flex-wrap gap-1.5 no-print">
            {presentCategories.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setCategory(category === entry ? null : entry)}
                title={CATEGORY_QUESTION[entry]}
                className={cn(
                  'chip transition-colors',
                  category === entry
                    ? 'border-accent/60 bg-accent/10 text-strong'
                    : 'hover:border-line-strong hover:text-body'
                )}
              >
                {CATEGORY_LABEL[entry]}
                <span className="mono text-faint">
                  {report.findings.filter((finding) => finding.category === entry).length}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {category ? (
        <p className="mb-4 border-l-2 border-accent/50 pl-3 text-sm italic text-muted">
          {CATEGORY_QUESTION[category]}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="card border-dashed p-6">
          <h2 className="text-sm font-semibold text-strong">
            {report.findings.length === 0 ? 'Nothing found' : 'Nothing in that filter'}
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            {report.findings.length === 0
              ? 'This program could not find a problem with the plan as described. That is a smaller claim than it sounds like: it has not seen your keys, cannot verify anything you told it, and only knows the failures it has rules for. The staleness section is the one to read next, because a plan nobody has tested is a plan nobody has tested.'
              : 'Clear the filters to see the rest.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              labelOf={labelOf}
              onOpenSubject={openSubject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
