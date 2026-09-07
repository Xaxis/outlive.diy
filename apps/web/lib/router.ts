'use client'

/**
 * Routing, in the fragment.
 *
 * The whole application is one document, and it stays one document on purpose.
 * Client-side navigation between prerendered routes would make the app request
 * things, which would mean loosening `connect-src 'none'` in the security
 * policy, which is the single line that makes "this app cannot send your plan
 * anywhere" enforceable rather than promised. The fragment costs nothing, keeps
 * the back button working, and makes every view linkable.
 */

import { useCallback, useSyncExternalStore } from 'react'

export type ViewId =
  | 'overview'
  | 'start'
  | 'design'
  | 'findings'
  | 'map'
  | 'scenarios'
  | 'runbook'
  | 'recovery'
  | 'letter'
  | 'compare'
  | 'file'
  | 'reasoning'

export interface Route {
  view: ViewId
  /** Second segment: which design tab, which scenario, which successor. */
  section: string | null
}

const VIEWS: ViewId[] = [
  'overview',
  'start',
  'design',
  'findings',
  'map',
  'scenarios',
  'runbook',
  'recovery',
  'letter',
  'compare',
  'file',
  'reasoning',
]

export const DEFAULT_ROUTE: Route = { view: 'overview', section: null }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const view = parts[0] as ViewId | undefined
  if (!view || !VIEWS.includes(view)) return DEFAULT_ROUTE
  return { view, section: parts[1] ? decodeURIComponent(parts[1]) : null }
}

export function formatHash(route: Route): string {
  return route.section ? `#/${route.view}/${encodeURIComponent(route.section)}` : `#/${route.view}`
}

function subscribe(callback: () => void) {
  // popstate as well as hashchange: pushing a fragment and then going back
  // fires both, and a router that listens to one of them is a back button that
  // works half the time.
  window.addEventListener('hashchange', callback)
  window.addEventListener('popstate', callback)
  return () => {
    window.removeEventListener('hashchange', callback)
    window.removeEventListener('popstate', callback)
  }
}

function getSnapshot() {
  return window.location.hash
}

/** The server render has no fragment, so it renders the default view. */
function getServerSnapshot() {
  return ''
}

export function useRoute(): [Route, (route: Route, options?: { replace?: boolean }) => void] {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const navigate = useCallback((route: Route, options: { replace?: boolean } = {}) => {
    const next = formatHash(route)
    if (window.location.hash === next) return
    // pushState rather than assigning location.hash, so that exactly one event
    // is dispatched rather than one from the assignment and one from here.
    if (options.replace) window.history.replaceState(null, '', next)
    else window.history.pushState(null, '', next)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    // A view change is a page change as far as a reader is concerned. Optional
    // call, because failing to scroll is never worth throwing over.
    window.scrollTo?.({ top: 0 })
  }, [])
  return [parseHash(hash), navigate]
}

export function href(view: ViewId, section?: string): string {
  return formatHash({ view, section: section ?? null })
}
