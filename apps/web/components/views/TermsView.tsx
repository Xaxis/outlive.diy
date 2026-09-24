import { href } from '@/lib/router.ts'

/**
 * The terms, short enough to be read.
 *
 * A tool about custody of money has to say plainly who is responsible for the
 * money, and the answer is the person using it. This says that, and the few
 * other things that follow from how the program is built: it holds nothing,
 * sends nothing unless asked to, and knows only what it is told.
 */
export function TermsView() {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-12 lg:py-16">
      <p className="eyebrow mb-1">outlive.diy</p>
      <h1 className="text-2xl font-semibold tracking-[-0.015em] text-strong">
        Terms of use and disclaimer
      </h1>
      <p className="mt-2 text-sm text-muted">
        Using outlive.diy means you accept these terms. If you do not, do not use it.
      </p>

      <dl className="mt-8 space-y-6 text-[0.9375rem] leading-relaxed">
        <Term title="You are responsible for your bitcoin">
          Every decision about your keys, backups, devices, places and people is yours, and so is
          everything that follows from it. outlive.diy, its authors, contributors, maintainers and
          anyone else associated with it are not responsible or liable for any loss, including loss
          of funds, theft, inaccessibility or any other damage, arising in any way from using the
          app, relying on it, or being unable to use it.
        </Term>
        <Term title="It is not advice">
          It is a model of a plan&apos;s structure. It does not know your real situation, cannot
          verify anything you tell it, and only knows the failures it has rules for. No findings
          means nothing it has a rule for, not that a plan is safe. Nothing here is financial,
          legal, tax or security advice. Take that from a qualified professional.
        </Term>
        <Term title="As is, without warranty">
          It is free software under the MIT license and is provided as is, without warranty of any
          kind, express or implied, including fitness for a particular purpose. It may contain
          mistakes. Check what it tells you before you act on it.
        </Term>
        <Term title="It holds nothing, and sends only what you ask it to">
          It has no field for key material and refuses it where it recognises it. Never enter a
          seed, key, descriptor, address or passphrase anyway. It makes no network calls of its own.
          If you enter your own Anthropic API key and ask Claude, the plan&apos;s structure and
          findings, without notes, go to Anthropic under your account and Anthropic&apos;s terms;
          Claude&apos;s answers are not this program&apos;s conclusions and may be wrong. Otherwise
          your plan stays in this browser or in files you save, and keeping those safe is up to you.
        </Term>
        <Term title="Names of products">
          Device and service names are used only so you can say what you own. No affiliation with,
          or endorsement by, any maker is implied.
        </Term>
        <Term title="Changes">
          These terms may change. The version published at outlive.diy is the one that applies.
        </Term>
      </dl>

      <p className="mt-10 border-t border-line pt-6 text-sm">
        <a href={href('home')} className="link">
          Back to outlive.diy
        </a>
      </p>
    </main>
  )
}

function Term({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-strong">{title}</dt>
      <dd className="mt-1 text-muted">{children}</dd>
    </div>
  )
}
