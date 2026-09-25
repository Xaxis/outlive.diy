'use client'

import { useEffect } from 'react'
import { TopBar } from './TopBar.tsx'
import { Toast } from './Toast.tsx'
import { Welcome } from '@/components/views/Welcome.tsx'
import { useStore } from '@/lib/store.ts'
import { sitePath } from '@/lib/site.ts'

/**
 * The landing page, which is the landing page every time.
 *
 * It used to be whatever the one document showed when nothing was stored, so
 * a returning visitor never saw it again and outlive.diy's own address opened
 * straight into somebody's plan. Now `/` is always this, listing the plans
 * this browser holds with a way into each, and the app lives at `/app/`.
 *
 * It reads storage on arrival, before anything it offers can write: starting
 * a plan here without reading first would save a file holding only that one.
 * A link from before the split, `/#/findings`, still lands where it pointed.
 */
export function Landing() {
  const hydrate = useStore((state) => state.hydrate)

  useEffect(() => {
    const forward = () => {
      if (!/^#\/./.test(window.location.hash)) return false
      window.location.replace(sitePath('app', window.location.hash))
      return true
    }
    if (forward()) return
    hydrate()
    // And a fragment added later, from a link on this page or a paste.
    window.addEventListener('hashchange', forward)
    return () => window.removeEventListener('hashchange', forward)
  }, [hydrate])

  return (
    <>
      <TopBar landing />
      <Welcome />
      <Toast />
    </>
  )
}
