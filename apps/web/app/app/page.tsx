import type { Metadata } from 'next'
import { App } from '@/components/shell/App.tsx'

export const metadata: Metadata = {
  title: 'Your plan · outlive.diy',
  // A plan lives in the visitor's own browser; there is nothing here for a
  // search engine to read.
  robots: { index: false, follow: false },
}

/** The application: one document, every view a fragment of it. */
export default function AppPage() {
  return <App />
}
