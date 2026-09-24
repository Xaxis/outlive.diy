'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, FileUp, ShieldCheck, WifiOff } from 'lucide-react'
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
  const plans = useStore((state) => state.plans)
  const activeId = useStore((state) => state.activeId)
  const setActive = useStore((state) => state.setActive)
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
        Pick the shape of your setup. See what a fire, a burglary or your death does to it, and fix
        what breaks in a click.
      </p>

      {plans.length > 0 ? (
        <section className="mt-8 rounded-[var(--radius-card)] border border-accent/30 bg-accent/[0.05] p-4">
          <h2 className="text-sm font-semibold text-strong">Your plans</h2>
          <ul className="mt-2 divide-y divide-line">
            {plans.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-strong">
                    {entry.name}
                  </span>
                  <span className="text-xs text-faint">
                    {entry.kind === 'draft' ? 'Draft' : 'Current'} · changed {entry.updatedAt} ·{' '}
                    {entry.keys.length} {entry.keys.length === 1 ? 'key' : 'keys'},{' '}
                    {entry.locations.length} {entry.locations.length === 1 ? 'place' : 'places'}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={entry.id === activeId ? 'primary' : 'default'}
                  icon={<ArrowRight className="size-3.5" aria-hidden />}
                  onClick={() => {
                    setActive(entry.id)
                    window.location.hash = href('overview').slice(1)
                  }}
                >
                  Continue
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={() => {
            window.location.hash = href('build').slice(1)
          }}
          icon={<ArrowRight className="size-4" aria-hidden />}
        >
          Build a plan
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            startPlan()
            window.location.hash = href('design').slice(1)
          }}
        >
          Describe one by hand
        </Button>
        <OpenFileButton icon={<FileUp className="size-4" aria-hidden />}>
          Open a plan file
        </OpenFileButton>
      </div>

      {/* The two promises, before anything is typed. One line each: they are
          the reason to trust the page, and a reason nobody reads protects
          nobody. The detail is one click away. */}
      <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        <li className="flex items-center gap-2">
          <ShieldCheck className="size-4 flex-none text-ok" aria-hidden />
          <span>
            <span className="font-medium text-strong">It refuses key material.</span> Every field
            refuses a pasted seed, key or address.
          </span>
        </li>
        <li className="flex items-center gap-2">
          <WifiOff className="size-4 flex-none text-ok" aria-hidden />
          <span>
            <span className="font-medium text-strong">It makes no network calls.</span>{' '}
            <a href={href('file')} className="link">
              What is stored
            </a>
          </span>
        </li>
      </ul>

      <section className="mt-12 border-t border-line pt-7">
        <h2 className="text-sm font-semibold text-strong">Or start from a worked example</h2>

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
                'Two of three keys, each a device and a steel plate, each in a place. Pick something to take away.'
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
          Structure, not advice. No findings means nothing this program has a rule for, not that a
          plan is safe.
        </p>
        <p className="mt-3">
          <a href={href('terms')} className="link">
            Terms and disclaimer
          </a>
          {' · '}
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
