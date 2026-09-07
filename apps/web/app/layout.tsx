import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://outlive.diy'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'outlive.diy — design and stress-test a Bitcoin custody plan',
  description:
    'A local-only tool for designing a Bitcoin self-custody and recovery plan and finding where it breaks. It never accepts seed words, keys or addresses, and it makes no network calls.',
  applicationName: 'outlive.diy',
  keywords: [
    'bitcoin self custody planning',
    'multisig recovery plan',
    'bitcoin inheritance planning',
    'seed backup strategy',
    'custody threat model',
  ],
  openGraph: {
    type: 'website',
    siteName: 'outlive.diy',
    url: SITE_URL,
    title: 'outlive.diy',
    description:
      'Describe the shape of your Bitcoin custody setup. Find out where it breaks, and get the runbook and the recovery routes.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#08090b' },
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
  ],
  width: 'device-width',
  initialScale: 1,
}

/**
 * Applied before first paint so the page never flashes the wrong theme.
 *
 * Dark is the default rather than the system preference: this interface is
 * dense, mostly dark-adapted, and the user who wants light asks for it once.
 */
const THEME_SCRIPT = `(function(){try{
var p=JSON.parse(localStorage.getItem('outlive.diy/preferences/v1')||'{}');
var t=p.theme||'dark';
if(t==='system'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}
document.documentElement.setAttribute('data-theme',t);
}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:border focus:border-line-strong focus:bg-surface focus:px-4 focus:py-2 no-print"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
