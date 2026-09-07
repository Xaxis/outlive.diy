'use client'

import { EyeOff, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button.tsx'
import { Callout, Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { useActivePlan } from '@/lib/store.ts'
import { useLetters } from '@/lib/analysis.ts'
import { href } from '@/lib/router.ts'

/**
 * The successor letter.
 *
 * Printed, put in an envelope, and read by somebody who has just lost the
 * person who wrote it. It contains no secret and no location, which is stated
 * on the page so that nobody helpfully adds one.
 */
export function LetterView() {
  const plan = useActivePlan()
  const letters = useLetters(plan)

  if (!plan) return null

  if (letters.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <ViewHeader eyebrow="Documents" title="Successor letter" />
        <Callout tone="warn" title="Nobody is described who could act">
          A letter needs somebody to be addressed to. Add a person with the role of successor or
          executor under{' '}
          <a
            href={href('design', 'people')}
            className="text-accent underline-offset-2 hover:underline"
          >
            People
          </a>
          , and this writes itself.
        </Callout>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ViewHeader
        eyebrow="Documents"
        title="Successor letter"
        question="One per successor, containing nothing worth stealing. Print it, seal it, and tell them where it is."
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

      <div className="space-y-8">
        {letters.map((letter) => (
          <article key={letter.to} className="print-page">
            <Panel className="p-6">
              <header className="border-b border-line pb-4">
                <p className="eyebrow">{letter.title}</p>
                <h2 className="mt-1 text-lg font-semibold text-strong">For {letter.to}</h2>
              </header>

              <div className="mt-5 space-y-6">
                {letter.sections.map((section) => (
                  <section key={section.heading} className="print-block">
                    <h3 className="text-sm font-semibold text-strong">{section.heading}</h3>
                    <div className="mt-1.5 space-y-2.5 text-[0.875rem] leading-relaxed text-body">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                    {section.steps ? (
                      <ol className="mt-3 space-y-2">
                        {section.steps.map((step, position) => (
                          <li key={step} className="flex gap-3">
                            <span className="mono mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border border-line-strong text-[0.6875rem] text-faint">
                              {position + 1}
                            </span>
                            <span className="text-[0.875rem] leading-relaxed text-body">
                              {step}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </section>
                ))}
              </div>

              <footer className="mt-6 border-t border-line pt-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-strong">
                  <EyeOff className="size-3.5 text-accent" aria-hidden />
                  What this letter deliberately does not contain
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-muted">
                  {letter.omissions.map((omission) => (
                    <li key={omission}>{omission}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-faint">
                  Do not add any of it. The letter is safe to leave with a solicitor, in a filing
                  cabinet, or with a relative precisely because it is worth nothing on its own.
                </p>
              </footer>
            </Panel>
          </article>
        ))}
      </div>
    </div>
  )
}
