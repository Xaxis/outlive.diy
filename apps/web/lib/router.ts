'use client'

/**
 * Routing, in the fragment.
 *
 * The whole application is one document, and it stays one document on purpose.
 * Client-side navigation between prerendered routes would make the app request
 * things, which would mean adding `'self'` to `connect-src` in the security
 * policy, which allows Anthropic and nothing else and is the line that makes
 * "this app sends your plan nowhere you did not ask" enforceable rather than
 * promised. The fragment costs nothing, keeps
 * the back button working, and makes every view linkable.
 */

import { useCallback, useSyncExternalStore } from 'react'
import { currentDocument, goTo, sitePath } from './site.ts'

export type ViewId =
  | 'home'
  | 'terms'
  | 'overview'
  | 'build'
  | 'design'
  | 'findings'
  | 'map'
  | 'runbook'
  | 'recovery'
  | 'letter'
  | 'compare'
  | 'file'
  | 'reasoning'
  | 'checkin'

export interface Route {
  view: ViewId
  /** Second segment: which design tab, which scenario, which successor. */
  section: string | null
}

const VIEWS: ViewId[] = [
  'home',
  'terms',
  'overview',
  'build',
  'design',
  'findings',
  'map',
  'runbook',
  'recovery',
  'letter',
  'compare',
  'file',
  'reasoning',
  'checkin',
]

export const DEFAULT_ROUTE: Route = { view: 'overview', section: null }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const first = parts[0]
  const section = parts[1] ? decodeURIComponent(parts[1]) : null
  // The stress test was a page that listed every world without drawing any of
  // them. The map draws them and now carries the list, so a link to the old
  // page lands on the map, still naming the world it meant.
  if (first === 'scenarios') return { view: 'map', section }
  // The guided route was a second shell around the design screens. They are one
  // screen now, and it is guided, so a link to a step lands on that step.
  if (first === 'start') return { view: 'design', section }
  const view = first as ViewId | undefined
  if (!view || !VIEWS.includes(view)) return DEFAULT_ROUTE
  return { view, section }
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
    setFragment(formatHash(route), options.replace)
  }, [])
  return [parseHash(hash), navigate]
}

/**
 * A link to a view. The landing page and the terms are documents of their
 * own, and any view linked from outside the app document is a link into it.
 */
export function href(view: ViewId, section?: string): string {
  if (view === 'home' || view === 'terms') return sitePath(view)
  const fragment = formatHash({ view, section: section ?? null })
  return currentDocument() === 'app' ? fragment : sitePath('app', fragment)
}

/**
 * Navigate from outside a component that holds the hook. The diagram is one
 * callback deep inside an SVG-adjacent tree, and threading a navigate function
 * down to it buys nothing: the fragment is global state either way.
 */
export function navigateTo(view: ViewId, section?: string): void {
  if (view === 'home' || view === 'terms' || currentDocument() !== 'app') {
    goTo(
      view === 'home' || view === 'terms' ? view : 'app',
      view === 'home' || view === 'terms' ? '' : formatHash({ view, section: section ?? null })
    )
    return
  }
  setFragment(href(view, section))
}

/**
 * Move to a fragment by assigning it, never through `history.pushState`.
 *
 * Next patches pushState and replays every call as a navigation of its own
 * router, in a transition. Two calls in quick succession, which is what an
 * agent driving the page does, left the app rendering the first view with the
 * second in the address bar. Assigning the fragment is invisible to Next. The
 * event is dispatched here as well as by the browser so the view changes in
 * this task rather than the next; the router reads the fragment either way,
 * so the second one changes nothing.
 */
function setFragment(next: string, replace = false) {
  if (window.location.hash === next) return
  if (replace) window.location.replace(next)
  else window.location.hash = next
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  // A view change is a page change as far as a reader is concerned. Optional
  // call, because failing to scroll is never worth throwing over.
  window.scrollTo?.({ top: 0 })
}
