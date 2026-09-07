import type { Metadata } from 'next'
import { Logo } from '@/components/brand/Logo.tsx'

export const metadata: Metadata = {
  title: 'Nothing here',
  robots: { index: false, follow: false },
}

/**
 * The one page that is not the app.
 *
 * The framework ships a white page with a number on it, which on a site that is
 * dark by default is a flash of white and a break in the voice. It is also the
 * wrong explanation: nothing is missing, because there is only ever one
 * document. Every view lives behind a fragment, so an address with a path in it
 * was either mistyped or is a bookmark from something else entirely.
 */
export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-5 py-16"
    >
      <Logo size={36} className="text-accent" />

      <h1 className="mt-7 text-3xl font-semibold leading-tight tracking-[-0.02em] text-strong">
        Nothing here.
      </h1>

      <p className="mt-4 text-[0.95rem] leading-relaxed text-muted">
        Not because a page is missing. This application is one document, and every view of it lives
        behind a <span className="mono text-body">#</span> in the address, so a link with a path in
        it never pointed at anything here.
      </p>

      <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
        Whatever plan you had open is still in this browser, untouched. It is not on a server, so
        there was nothing here to lose.
      </p>

      {/* A plain anchor, and a real document load. This page is served by the
          host at some path that is not the application, so the way back is to
          fetch the application, not to ask a router that is not running here to
          pretend it already has it. */}
      <p className="mt-7">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/#/overview" className="btn btn-primary no-underline">
          Go to the app
        </a>
      </p>
    </main>
  )
}
