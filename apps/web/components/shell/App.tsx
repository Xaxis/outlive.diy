'use client'

import { useEffect, useRef, useState } from 'react'
import { useRoute } from '@/lib/router.ts'
import { useActivePlan, useStore } from '@/lib/store.ts'
import { useLetters, useReport } from '@/lib/analysis.ts'
import { Sidebar } from './Sidebar.tsx'
import { TopBar } from './TopBar.tsx'
import { Toast } from './Toast.tsx'
import { ScopeNotice } from './ScopeNotice.tsx'
import { CommandPalette } from './CommandPalette.tsx'
import { ViewBoundary } from './ViewBoundary.tsx'
import { goTo } from '@/lib/site.ts'
import { registerAgentTools } from '@/lib/agent/register.ts'
import { Welcome } from '@/components/views/Welcome.tsx'
import { BuildView } from '@/components/views/BuildView.tsx'
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
import { CheckInView } from '@/components/views/CheckInView.tsx'
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

  // Tools for an AI agent built into the reader's browser, if it has one.
  // Once the plan is loaded, so the first call answers about the real plan.
  useEffect(() => (ready ? registerAgentTools() : undefined), [ready])

  // The drawer closes whenever the route changes, however it changed: the
  // sidebar, the palette, a link in a view, the back button or an assistant.
  // A backdrop left over a view nobody asked to cover swallows every tap.
  const [drawerRoute, setDrawerRoute] = useState(route)
  if (drawerRoute.view !== route.view || drawerRoute.section !== route.section) {
    setDrawerRoute(route)
    if (drawerOpen) setDrawerOpen(false)
  }

  // And on Escape, like every other thing that covers the page.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

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
  // The landing page is somewhere to go back to, not only somewhere to start:
  // the logo leads here, and with plans open it leads with them.
  // Nothing is drawn until storage has been read: the document is prerendered
  // with nothing in it, so a returning visitor sees their plan and not a flash
  // of a page that is not theirs.
  if (!ready) return <main id="main" className="min-h-dvh" />

  // The landing page and the terms are documents of their own now. A fragment
  // that still names one of them is an old link; follow it.
  if (route.view === 'home' || route.view === 'terms') return <Redirect to={route.view} />

  if (!hasPlans || !plan) {
    return (
      <>
        <TopBar onToggleSidebar={() => setDrawerOpen((value) => !value)} />
        {route.view === 'build' ? (
          <main id="main" className="mx-auto w-full max-w-[74rem] px-4 py-6 lg:px-8 lg:py-8">
            <BuildView />
          </main>
        ) : (
          <Welcome />
        )}
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
            {/* Keyed by the view, so moving to another one tries again. */}
            <ViewBoundary key={route.view}>
              <View />
            </ViewBoundary>
          </div>
        </main>
      </div>
      <CommandPalette plan={plan} report={report} />
      <Toast />
    </>
  )
}

function Redirect({ to }: { to: 'home' | 'terms' }) {
  useEffect(() => {
    goTo(to)
  }, [to])
  return null
}

function View() {
  const [route] = useRoute()
  switch (route.view) {
    case 'build':
      return <BuildView />
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
    case 'checkin':
      return <CheckInView />
    case 'overview':
    default:
      return <OverviewView />
  }
}
