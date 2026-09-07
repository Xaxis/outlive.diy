'use client'

import { useState } from 'react'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_QUESTION,
  RULES,
  type FindingCategory,
} from '@outlive/core'
import { MEASURE, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * The rule catalogue, written out.
 *
 * Every rule the engine can fire is listed here, with what it looks for and why
 * it thinks that matters. A tool that tells somebody their custody plan is
 * broken owes them the ability to read its reasoning and disagree with it.
 */
export function ReasoningView() {
  const [open, setOpen] = useState<FindingCategory | null>(null)
  const rules = Object.values(RULES)

  return (
    <div className={MEASURE.read}>
      <ViewHeader
        eyebrow="Judgement"
        title="How it reasons"
        question={`Every one of the ${rules.length} rules, and the assumptions underneath them. Disagreeing with a rule is a legitimate outcome of reading it.`}
      />

      <Panel className="mb-5 p-4">
        <SectionHeading title="One question, asked in different worlds" />
        <div className="space-y-3 text-[0.875rem] leading-relaxed text-muted">
          <p>
            Everything here is the same computation: given who can reach what, can this wallet be
            spent? Loss subtracts an object. Compromise stands in the attacker&apos;s shoes.
            Succession removes your memory along with you. Coercion assumes you cooperate, because
            that is what compulsion means.
          </p>
          <p>
            One evaluator answers all of them, so the results cannot contradict each other. A
            planner that says a setup survives a fire and also that it does not is worse than one
            that says nothing.
          </p>
          <p>
            Where a fact is missing, the direction of the guess follows the question. Asking whether{' '}
            <em className="not-italic text-body">you</em> can recover, an unrecorded location is
            assumed findable, because you know where your own things are. Asking whether somebody
            standing in one specific room can spend, it is not.
          </p>
        </div>
      </Panel>

      <Panel className="mb-5 p-4">
        <SectionHeading title="What it does not know" />
        <ul className="list-disc space-y-1.5 pl-5 text-[0.875rem] leading-relaxed text-muted">
          <li>Your actual adversary, or whether anybody is interested in you at all.</li>
          <li>
            Whether anything you typed is true. It cannot see your backups and has no way to check.
          </li>
          <li>
            Anything device-specific, unless you load your own vendor file. Facts about hardware
            rot, and a stale fact stated confidently is worse than no fact.
          </li>
          <li>
            Fees, transaction construction, address reuse, network privacy, or anything on-chain.
            Those matter and are a different tool.
          </li>
          <li>
            Law. Probate, marital property and jurisdiction are modelled here only as delays and
            groupings.
          </li>
        </ul>
      </Panel>

      <div className="space-y-3">
        {CATEGORY_ORDER.map((category) => {
          const inCategory = rules.filter((rule) => rule.category === category)
          const expanded = open === category
          return (
            <Panel key={category} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : category)}
                aria-expanded={expanded}
                className="flex w-full items-baseline justify-between gap-3 p-4 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-strong">
                    {CATEGORY_LABEL[category]}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] text-muted">
                    {CATEGORY_QUESTION[category]}
                  </span>
                </span>
                <span className="mono flex-none text-xs text-faint">{inCategory.length} rules</span>
              </button>

              {expanded ? (
                <ul className="divide-y divide-line border-t border-line">
                  {inCategory.map((rule) => (
                    <li key={rule.id} className="flex gap-3 p-4">
                      <span className="mono w-10 flex-none text-xs text-faint">{rule.id}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <SeverityDot severity={rule.baseSeverity} />
                          <span className="text-[0.875rem] font-medium text-strong">
                            {rule.looksFor}
                          </span>
                        </span>
                        <span className="mt-1 block text-[0.8125rem] leading-relaxed text-muted">
                          {rule.because}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          )
        })}
      </div>

      <p className={cn('mt-6 text-xs leading-relaxed text-faint')}>
        Severities shown here are the base level. A finding about a vault holding most of the stack
        is raised a step; one about a decoy wallet is lowered two, because losing a decoy is the
        plan. What you told this program you are worried about changes the order findings are read
        in and never whether they appear.
      </p>
    </div>
  )
}
