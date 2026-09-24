'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, FileUp } from 'lucide-react'
import {
  baseWorld,
  buildGraph,
  createContext,
  enumerateScenarios,
  EXAMPLES,
  exampleById,
  runScenario,
} from '@outlive/core'
import { VERDICT } from '@/lib/verdict.ts'
import { cn } from '@/lib/cn.ts'
import { Button } from '@/components/ui/Button.tsx'
import { PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
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

  // One worked example, drawn. A page about a tool whose main output is a
  // picture should show the picture, and this is the only place on the site
  // where there is no plan of the reader's own to draw instead.
  //
  // And a few things to take away from it. The caption used to say "take any
  // of them away and the picture answers" beside a picture that could not be
  // touched; now it can, which demonstrates what this is faster than any
  // sentence about it. Each is a world the engine enumerates, not one made up
  // for the landing page.
  const example = useMemo(() => exampleById('two-of-three'), [])
  const worlds = useMemo(() => {
    if (!example) return []
    const ctx = createContext(example)
    const all = enumerateScenarios(ctx)
    // Every place, one device and one break-in: the three kinds of news the
    // drawing can give, which are a place gone, a thing gone, and a room
    // somebody else is standing in.
    const picked = [
      ...all.filter((scenario) => scenario.kind === 'location-lost'),
      ...all.filter((scenario) => scenario.kind === 'device-lost').slice(0, 1),
      ...all.filter((scenario) => scenario.kind === 'location-compromised').slice(0, 1),
    ]
    return picked.map((scenario) => runScenario(ctx, scenario))
  }, [example])
  const [worldId, setWorldId] = useState<string | null>(null)
  const current = worlds.find((result) => result.scenario.id === worldId) ?? null
  const preview = useMemo(
    () =>
      example
        ? buildGraph(example, current?.scenario.world ?? baseWorld(example), {
            includePeople: false,
          })
        : null,
    [example, current]
  )

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
            window.location.hash = href('design').slice(1)
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

        {preview && example ? (
          <figure className="mt-5">
            <div
              role="group"
              aria-label="What if"
              className="mb-2 flex flex-wrap items-center gap-1.5"
            >
              <span className="mr-1 text-xs text-faint">What if:</span>
              {[null, ...worlds].map((result) => {
                const id = result?.scenario.id ?? null
                const active = worldId === id
                return (
                  <button
                    key={id ?? 'nothing'}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setWorldId(id)}
                    className={cn(
                      'chip transition-colors',
                      active
                        ? 'border-accent bg-accent/10 text-strong'
                        : 'hover:border-line-strong hover:text-strong'
                    )}
                  >
                    {result ? result.scenario.world.label : 'Nothing wrong'}
                  </button>
                )
              })}
            </div>
            <PlanDiagram graph={preview} />
            <figcaption className="mt-2 text-xs leading-relaxed text-faint" aria-live="polite">
              {current ? (
                <>
                  <span className="text-body">{current.scenario.label}.</span>{' '}
                  {current.wallets.map((outcome, position) => {
                    const wallet = example.wallets.find((entry) => entry.id === outcome.walletId)
                    return (
                      <span key={outcome.walletId}>
                        {position > 0 ? ', ' : ''}
                        {wallet?.label ?? 'A wallet'}:{' '}
                        <span
                          className={cn(
                            'font-medium',
                            outcome.verdict === 'safe'
                              ? 'text-ok'
                              : outcome.verdict === 'degraded'
                                ? 'text-medium'
                                : 'text-critical'
                          )}
                        >
                          {VERDICT[outcome.verdict].label}
                        </span>
                      </span>
                    )
                  })}
                  .
                </>
              ) : (
                'The second example, drawn: two of three keys spend it, each key exists as a device and a steel plate, and every one of those sits in a place. Take one of them away above and the picture answers.'
              )}
            </figcaption>
          </figure>
        ) : null}
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
