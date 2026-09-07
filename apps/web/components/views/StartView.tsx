'use client'

import { ArrowLeft, ArrowRight, Check, ListChecks } from 'lucide-react'
import type { Plan } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { Callout, Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { ProfileEditor } from '@/components/plan/ProfileEditor.tsx'
import { EntityWorkbench } from '@/components/plan/EntityWorkbench.tsx'
import { SeverityBar } from '@/components/ui/Severity.tsx'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useReport } from '@/lib/analysis.ts'
import { useRoute } from '@/lib/router.ts'
import { SECTIONS } from '@/lib/sections.ts'
import { cn } from '@/lib/cn.ts'

type StepId = (typeof SECTIONS)[number]['id'] | 'result'

interface Step {
  id: StepId
  label: string
  /** Whether this step has been answered, for the rail. */
  done: (plan: Plan) => boolean
  /**
   * A step that is legitimately skippable. It never shows a tick, because a
   * tick against something nobody did is the rail telling a small lie.
   */
  optional?: boolean
  /** What this step is for, in the second person. */
  purpose: string
}

const STEPS: Step[] = [
  {
    id: 'profile',
    label: 'Purpose',
    done: (plan) => plan.profile.concerns.length > 0,
    purpose:
      'None of this suppresses a finding. It decides which ones you read first, because a list that treats every risk as equally urgent is a list nobody finishes.',
  },
  {
    id: 'locations',
    label: 'Places',
    done: (plan) => plan.locations.length > 0,
    purpose:
      'Give each place a role label and, more importantly, say what it would fail together with. Two sites in one flood plain are one site as far as fire and flood are concerned.',
  },
  {
    id: 'people',
    label: 'People',
    done: (plan) => plan.people.length > 0,
    optional: true,
    purpose:
      'Optional, and the step most people skip and later regret. A plan nobody has been told about is a plan nobody starts.',
  },
  {
    id: 'devices',
    label: 'Devices',
    done: (plan) => plan.devices.length > 0 || plan.keys.length > 0,
    purpose:
      'What signs. If a key exists only as a written backup with no device, that is a legitimate design and you can skip ahead.',
  },
  {
    id: 'keys',
    label: 'Keys',
    done: (plan) => plan.keys.length > 0,
    purpose:
      'The device, and separately everything the key could be rebuilt from. Those two being in the same place is the single most common flaw this program finds.',
  },
  {
    id: 'wallets',
    label: 'Wallets',
    done: (plan) => plan.wallets.length > 0,
    purpose:
      'A threshold over keys. For anything multisig, say where the descriptor lives too: a threshold of seeds without it restores nothing.',
  },
  {
    id: 'checks',
    label: 'Checks',
    done: (plan) => plan.verifications.length > 0,
    purpose:
      'What you have actually proved. Everything above is a description of what you believe until something here says otherwise.',
  },
  {
    id: 'result',
    label: 'What breaks',
    done: () => false,
    optional: true,
    purpose: 'Every way the plan above comes apart, worst first.',
  },
]

/**
 * The guided route.
 *
 * It is the same editors in the same order as the design screens, with one
 * addition: a reason for each step, written before the fields rather than after
 * them. Somebody describing their custody setup for the first time needs to
 * know why they are being asked, or they answer the easy version of the
 * question.
 */
export function StartView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const select = useStore((state) => state.select)
  const [route, navigate] = useRoute()

  if (!plan || !report) return null

  const index = Math.max(
    0,
    STEPS.findIndex((step) => step.id === (route.section ?? 'profile'))
  )
  const step = STEPS[index]
  const definition = SECTIONS.find((entry) => entry.id === step.id)

  const go = (next: number) => {
    select(null)
    navigate({ view: 'start', section: STEPS[Math.min(STEPS.length - 1, Math.max(0, next))].id })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <ViewHeader
        eyebrow={`Step ${index + 1} of ${STEPS.length}`}
        title={step.label}
        question={step.purpose}
      />

      <ol className="mb-6 flex flex-wrap items-center gap-1 no-print">
        {STEPS.map((entry, position) => {
          const done = entry.done(plan)
          const current = position === index
          return (
            <li key={entry.id} className="flex items-center">
              <button
                type="button"
                onClick={() => go(position)}
                aria-current={current ? 'step' : undefined}
                title={entry.optional ? 'Optional' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  current
                    ? 'border-accent bg-accent/10 font-medium text-strong'
                    : done
                      ? 'border-line-strong text-muted hover:text-strong'
                      : 'border-line text-faint hover:text-muted'
                )}
              >
                {done && !current ? (
                  <Check className="size-3 text-ok" aria-hidden />
                ) : (
                  <span className="mono">{position + 1}</span>
                )}
                {entry.label}
              </button>
              {position < STEPS.length - 1 ? (
                <span className="mx-0.5 h-px w-3 bg-line" aria-hidden />
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="mb-6">
        {step.id === 'profile' ? (
          <ProfileEditor plan={plan} />
        ) : step.id === 'result' ? (
          <Result />
        ) : definition?.kind ? (
          <EntityWorkbench
            plan={plan}
            report={report}
            kind={definition.kind}
            singular={definition.singular}
            blurb={definition.blurb}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4 no-print">
        <Button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          icon={<ArrowLeft className="size-4" aria-hidden />}
        >
          Back
        </Button>
        <span className="text-xs text-faint">
          Everything is saved as you type. You can leave this route at any point and edit anything
          directly.
        </span>
        {index < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => go(index + 1)}>
            Next
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="primary" onClick={() => navigate({ view: 'findings', section: null })}>
            Read the findings
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}

function Result() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const [, navigate] = useRoute()
  if (!plan || !report) return null

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <SeverityBar counts={report.counts} />
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {report.findings.length === 0
            ? 'Nothing found in what you have described. That is a small claim: this program has not seen your keys, cannot verify anything you told it, and only knows the failures it has rules for.'
            : `Worst first. Each one names the thing to do about it, and every one is a claim you can disagree with after reading the rule behind it.`}
        </p>
      </Panel>

      {report.findings.slice(0, 3).map((finding) => (
        <Panel key={finding.id} data-sev={finding.severity} className="sev-edge p-4">
          <p className="text-sm font-medium text-strong">{finding.title}</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{finding.detail}</p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-body">{finding.remediation}</p>
        </Panel>
      ))}

      <Callout tone="accent" title="Next">
        The build runbook turns this into ordered steps, with the verification gates called out. The
        recovery routes turn it into what to do on the day.
      </Callout>

      <Button
        variant="primary"
        icon={<ListChecks className="size-4" aria-hidden />}
        onClick={() => navigate({ view: 'findings', section: null })}
      >
        Read all {report.findings.length} findings
      </Button>
    </div>
  )
}
