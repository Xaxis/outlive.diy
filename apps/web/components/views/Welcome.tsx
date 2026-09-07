'use client'

import { ArrowRight, FileUp } from 'lucide-react'
import { EXAMPLES } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { useStore } from '@/lib/store.ts'
import { href } from '@/lib/router.ts'
import { OpenFileButton } from '@/components/file/OpenFileButton.tsx'

/**
 * The landing page, and the prerendered document.
 *
 * Short on purpose. Somebody deciding whether to describe their custody setup
 * to a website needs three things before anything else: what this does, what it
 * refuses to hold, and a way in. Everything past that is the product itself,
 * and the worked examples explain it better than a feature grid would.
 */
export function Welcome() {
  const startPlan = useStore((state) => state.startPlan)
  const openExample = useStore((state) => state.openExample)

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-14 lg:py-20">
      <h1 className="text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.025em] text-strong sm:text-[2.6rem]">
        Design a Bitcoin custody plan, then find out where it breaks.
      </h1>

      <p className="mt-5 max-w-2xl text-[1.02rem] leading-relaxed text-muted">
        Describe the <em className="not-italic text-body">shape</em> of your setup: how many keys,
        what threshold, which backups sit where, who can reach them. This works out what happens
        when one of those is gone, or in the wrong hands, or when you are, and writes the runbook to
        build it and the recovery route for each way it fails.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={() => {
            startPlan()
            window.location.hash = href('start').slice(1)
          }}
          icon={<ArrowRight className="size-4" aria-hidden />}
        >
          Start a plan
        </Button>
        <OpenFileButton icon={<FileUp className="size-4" aria-hidden />}>
          Open a plan file
        </OpenFileButton>
      </div>

      {/* The two promises, before anything is typed. */}
      <dl className="mt-12 space-y-4 border-t border-line pt-7 text-[0.9375rem] leading-relaxed">
        <div>
          <dt className="font-medium text-strong">It refuses key material.</dt>
          <dd className="text-muted">
            No field anywhere for a seed word, key, descriptor, address or balance, and every text
            box checks what you type and will not store one. Places and people are roles:{' '}
            <span className="text-body">Site B</span>,{' '}
            <span className="text-body">Successor 1</span>.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-strong">It makes no network calls.</dt>
          <dd className="text-muted">
            No fonts from a content network, no analytics, no telemetry. One static page whose
            security policy forbids connecting anywhere at all.{' '}
            <a href={href('file')} className="link">
              What is stored, and how to erase it
            </a>
            .
          </dd>
        </div>
      </dl>

      <section className="mt-12 border-t border-line pt-7">
        <h2 className="text-sm font-semibold text-strong">Start from a worked example</h2>
        <p className="mt-1 text-sm text-muted">
          Each is a plan somebody plausibly has. Open two and compare them.
        </p>
        <ul className="mt-4 divide-y divide-line">
          {EXAMPLES.map((example) => (
            <li key={example.id}>
              <button
                type="button"
                onClick={() => {
                  openExample(example.id)
                  window.location.hash = href('findings').slice(1)
                }}
                className="group flex w-full items-baseline gap-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-strong">{example.name}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                    {example.summary}
                  </span>
                </span>
                <ArrowRight
                  className="size-4 flex-none text-faint transition-colors group-hover:text-accent"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-12 border-t border-line pt-7 text-xs leading-relaxed text-faint">
        <p className="max-w-2xl">
          It models structure. It does not know your real threat, cannot verify anything you tell
          it, and is not advice. A plan with no findings here is a plan this program could not find
          a problem with, which is a much smaller claim than it sounds like.
        </p>
        <p className="mt-3">
          <a href={href('reasoning')} className="link">
            Every rule it applies
          </a>
          {' · '}
          <a href="https://github.com/Xaxis/outlive.diy" className="link" rel="noreferrer">
            Source
          </a>
        </p>
      </footer>
    </main>
  )
}
