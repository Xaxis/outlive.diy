'use client'

import { ArrowRight, FileUp, Layers, MapPin, ShieldOff, Users, WifiOff } from 'lucide-react'
import { EXAMPLES } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { Card } from '@/components/ui/Surface.tsx'
import { useStore } from '@/lib/store.ts'
import { href } from '@/lib/router.ts'
import { OpenFileButton } from '@/components/file/OpenFileButton.tsx'

/**
 * The landing page, and the prerendered document.
 *
 * It has one job beyond explaining the tool: to say, before anybody types
 * anything, exactly what this program will and will not accept. Somebody
 * deciding whether to describe their custody setup to a website is asking a
 * reasonable question, and the answer belongs above the fold rather than on a
 * policy page.
 */
export function Welcome() {
  const startPlan = useStore((state) => state.startPlan)
  const openExample = useStore((state) => state.openExample)

  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-12 lg:py-20">
      <p className="eyebrow">A planner for the part that has to work without you</p>
      <h1 className="mt-3 max-w-3xl text-balance text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-strong sm:text-[2.6rem]">
        Design a Bitcoin custody plan, then find out where it breaks.
      </h1>
      <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted">
        Describe the <em className="not-italic text-body">shape</em> of your setup: how many keys,
        what threshold, which backups sit where, who can reach them. This works out what happens
        when one of those things is gone, or in the wrong hands, or when you are, and then writes
        the runbook to build it and the recovery route for each way it fails.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
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

      {/* --- the promise, stated before anything is typed --- */}
      <section className="mt-14 grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <ShieldOff className="size-5 text-accent" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-strong">It refuses key material</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            There is no field anywhere for a seed word, an extended key, a descriptor, a private
            key, a PIN, a passphrase, an address or a balance. Every free-text box checks what you
            type and refuses to store any of those, telling you what it recognised. Locations and
            people are roles: <span className="text-body">Site B</span>,{' '}
            <span className="text-body">Successor 1</span>.
          </p>
        </Card>
        <Card className="p-5">
          <WifiOff className="size-5 text-accent" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-strong">It makes no network calls</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            No fonts from a content network, no analytics, no telemetry, no error reporting, no
            update check. One static page whose security policy forbids connecting anywhere at all,
            and a build that fails if the source ever gains a way to.{' '}
            <a href={href('file')} className="text-accent underline-offset-2 hover:underline">
              What is stored, and how to erase it
            </a>
            .
          </p>
        </Card>
      </section>

      {/* --- what the analysis actually does --- */}
      <section className="mt-14">
        <h2 className="text-base font-semibold text-strong">What it works out</h2>
        <ul className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {[
            {
              icon: Layers,
              title: 'Remove one thing',
              body: 'Every key, device, backup, location and person, taken away one at a time. Which wallets survive, and which are one bad afternoon from gone.',
            },
            {
              icon: MapPin,
              title: 'Open one container',
              body: 'The same enumeration from the other side. A written backup is a key in an attacker’s hands; a PIN-locked device is not, until they also have you.',
            },
            {
              icon: Users,
              title: 'Outlive it',
              body: 'Whether the people who outlive you can reach the coins, and the failure nobody talks about: whether they can reach them today.',
            },
            {
              icon: ShieldOff,
              title: 'Independence that is not',
              body: 'Two keys from one vendor are one decision. Three sites in one flood plain are one storm. A threshold is a claim about independence, and this checks it.',
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-3">
              <item.icon className="mt-0.5 size-4 flex-none text-faint" aria-hidden />
              <div>
                <h3 className="text-sm font-medium text-strong">{item.title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --- examples --- */}
      <section className="mt-14">
        <h2 className="text-base font-semibold text-strong">Or start from a worked example</h2>
        <p className="mt-1 text-sm text-muted">
          Each one is a plan somebody plausibly has. Open two and compare them.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {EXAMPLES.map((example) => (
            <Card
              key={example.id}
              className="flex flex-col p-4"
              onClick={() => {
                openExample(example.id)
                window.location.hash = href('findings').slice(1)
              }}
            >
              <h3 className="text-sm font-semibold text-strong">{example.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{example.summary}</p>
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-faint">
                {example.teaches}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-xs leading-relaxed text-faint">
        <p className="max-w-2xl">
          This models structure. It does not know your real threat, cannot verify anything you tell
          it, and is not advice. A plan with no findings here is a plan this program could not find
          a problem with, which is a much smaller claim than it sounds like.
        </p>
        <p className="mt-3">
          <a href={href('reasoning')} className="text-accent underline-offset-2 hover:underline">
            Every rule it applies, written out
          </a>
          {' · '}
          <a
            href="https://github.com/Xaxis/outlive.diy"
            className="text-accent underline-offset-2 hover:underline"
            rel="noreferrer"
          >
            Source
          </a>
        </p>
      </footer>
    </main>
  )
}
