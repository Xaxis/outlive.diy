'use client'

/**
 * The site's three documents, and how to get between them.
 *
 * `/` is the landing page and always is, whether or not you have been here
 * before. `/app/` is the application, whose views are fragments of that one
 * document. `/terms/` is the terms. Moving between documents is an ordinary
 * page load, never a client-side fetch: the security policy allows fetching
 * from Anthropic and nothing else, and a router that prefetched pages would
 * need `'self'` in it.
 *
 * Hosted, links are absolute. Opened from a disk, where `/` is the root of
 * the filesystem, they are relative and name `index.html`, because there a
 * directory is not a page.
 */

export type Document = 'home' | 'app' | 'terms'

/** Which document this code is running in. */
export function currentDocument(): Document {
  if (typeof window === 'undefined') return 'home'
  const path = window.location.pathname
  if (/\/app\/(index\.html)?$/.test(path)) return 'app'
  if (/\/terms\/(index\.html)?$/.test(path)) return 'terms'
  return 'home'
}

/**
 * A link from the current document to another, with an optional fragment.
 *
 * Absolute when hosted, which is also what the prerendered pages carry, so
 * the server and the browser agree on every link. Relative with `index.html`
 * when opened from a disk, where an absolute path is the filesystem root.
 */
export function sitePath(target: Document, fragment = ''): string {
  const onDisk = typeof window !== 'undefined' && window.location.protocol === 'file:'
  const dir = target === 'home' ? '' : `${target}/`
  if (!onDisk) return `/${dir}${fragment}`
  const up = currentDocument() === 'home' ? '' : '../'
  return `${up}${dir}index.html${fragment}`
}

/** Go to another document, or to a fragment of this one if it is the app. */
export function goTo(target: Document, fragment = ''): void {
  if (target === 'app' && currentDocument() === 'app') {
    window.location.hash = fragment.replace(/^#/, '')
    return
  }
  window.location.assign(sitePath(target, fragment))
}
