'use client'

import { useEffect, useRef, useState } from 'react'
import { useRoute } from '@/lib/router.ts'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useLetters, useReport } from '@/lib/analysis.ts'
import { Sidebar } from './Sidebar.tsx'
import { TopBar } from './TopBar.tsx'
import { Toast } from './Toast.tsx'
import { ScopeNotice } from './ScopeNotice.tsx'
import { Welcome } from '@/components/views/Welcome.tsx'
import { OverviewView } from '@/components/views/OverviewView.tsx'
import { DesignView } from '@/components/views/DesignView.tsx'
import { FindingsView } from '@/components/views/FindingsView.tsx'
import { MapView } from '@/components/views/MapView.tsx'
import { RunbookView } from '@/components/views/RunbookView.tsx'
import { RecoveryView } from '@/components/views/RecoveryView.tsx'
import { LetterView } from '@/components/views/LetterView.tsx'
import { CompareView } from '@/components/views/CompareView.tsx'
import { FileView } from '@/components/views/FileView.tsx'
import { ReasoningView } from '@/components/views/ReasoningView.tsx'
import { useShortcuts, useUnsavedWarning } from '@/lib/shortcuts.ts'
import { cn } from '@/lib/cn.ts'

/**
 * The stacking order, in one place, because it only goes wrong when it is
 * decided in several.
 *
 *   10  sticky chrome inside a view, such as the map's first column
 *   20  the mobile drawer's backdrop
 *   30  the sidebar
 *   40  the top bar, which has to be above the sidebar or the menus it opens
 *       are trapped in a lower stacking context and paint underneath it
 *   50  toasts
 *   60  dialogs
 *   70  the skip link, which has to beat everything
 */

export function App() {
  const hydrate = useStore((state) => state.hydrate)
  const ready = useStore((state) => state.ready)
  const hasPlans = useStore((state) => state.plans.length > 0)
  const plan = useActivePlan()
  const report = useReport(plan)
  const letters = useLetters(plan)
  const [route] = useRoute()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const main = useRef<HTMLElement>(null)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useShortcuts()
  useUnsavedWarning()

  // Closing the drawer belongs to navigation, which is an external event, not
  // to a change in derived state.
  useEffect(() => {
    const close = () => setDrawerOpen(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  // A view change is a page change. Without this, a keyboard or screen reader
  // user activates a link in the sidebar and their position stays in the
  // sidebar, with no announcement that anything happened. Only on the view,
  // not the section, so moving between design tabs does not yank focus.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    // preventScroll, or the browser scrolls main's top to the top of the
    // viewport and slides the sticky header over the section label. The
    // scrolling is navigate's job and it has already done it.
    main.current?.focus?.({ preventScroll: true })
  }, [route.view])

  // Local storage cannot be read during render, so the prerendered document is
  // the landing page. That is also the right thing to serve: it is what a first
  // visitor sees, and it is the only part of this application worth indexing.
  if (!ready || !hasPlans || !plan) {
    return (
      <>
        <TopBar onToggleSidebar={() => setDrawerOpen((value) => !value)} />
        <Welcome />
        <Toast />
      </>
    )
  }

  return (
    <>
      <TopBar onToggleSidebar={() => setDrawerOpen((value) => !value)} />
      <div className="mx-auto flex w-full max-w-[1600px] items-start">
        <aside
          className={cn(
            'no-print z-30 w-60 shrink-0 border-r border-line bg-surface',
            'fixed inset-y-0 left-0 top-[3.05rem] -translate-x-full transition-transform lg:sticky lg:top-[3.05rem] lg:h-[calc(100dvh-3.05rem)] lg:translate-x-0',
            drawerOpen && 'translate-x-0'
          )}
        >
          <div className="flex h-full flex-col overflow-y-auto">
            <Sidebar
              route={route}
              report={report}
              letterCount={letters.length}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </aside>

        {drawerOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-20 bg-[rgb(0_0_0/0.5)] lg:hidden no-print"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        <main
          id="main"
          ref={main}
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 outline-none lg:px-8 lg:py-8"
        >
          {/* One column for every view, so the left edge and the top of the
              heading are in the same place whichever one you are on. */}
          <div className="mx-auto w-full max-w-[74rem]">
            <ScopeNotice />
            <View />
          </div>
        </main>
      </div>
      <Toast />
    </>
  )
}

function View() {
  const [route] = useRoute()
  switch (route.view) {
    case 'design':
      return <DesignView />
    case 'findings':
      return <FindingsView />
    case 'map':
      return <MapView />
    case 'runbook':
      return <RunbookView />
    case 'recovery':
      return <RecoveryView />
    case 'letter':
      return <LetterView />
    case 'compare':
      return <CompareView />
    case 'file':
      return <FileView />
    case 'reasoning':
      return <ReasoningView />
    case 'overview':
    default:
      return <OverviewView />
  }
}
