'use client'

/**
 * Where the plan lives, stated plainly.
 *
 * Two places and no others. The browser's local storage for this one origin,
 * so that closing the tab does not lose an afternoon's work, and files the user
 * saves themselves. Nothing is uploaded, because there is nothing to upload to.
 *
 * The user may be on a machine they do not fully trust, so local storage is a
 * choice they can decline: in memory-only mode nothing is written at all and
 * the plan lasts exactly as long as the tab does.
 */

import { parsePlanFile, type Plan, type PlanFile, SCHEMA_VERSION, today } from '@outlive/core'

export const STORAGE_KEY = 'outlive.diy/plan-file/v1'
export const PREFERENCES_KEY = 'outlive.diy/preferences/v1'
export const VENDOR_KEY = 'outlive.diy/vendor-data/v1'

export const GENERATOR = 'outlive.diy'

export type Persistence = 'local' | 'memory'

export interface Preferences {
  theme: 'dark' | 'light' | 'system'
  persistence: Persistence
  /** Whether the user has seen and dismissed the one-time statement of scope. */
  scopeAcknowledged: boolean
}

export const defaultPreferences: Preferences = {
  theme: 'dark',
  persistence: 'local',
  scopeAcknowledged: false,
}

function safeRead(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private windows, disabled site data, and a full quota all land here. The
    // application keeps working; it just forgets when the tab closes.
  }
  invalidate()
}

export function readPreferences(): Preferences {
  const stored = safeRead(PREFERENCES_KEY)
  if (!stored || typeof stored !== 'object') return defaultPreferences
  return { ...defaultPreferences, ...(stored as Partial<Preferences>) }
}

export function writePreferences(preferences: Preferences): void {
  safeWrite(PREFERENCES_KEY, preferences)
}

export const UNREADABLE_KEY = 'outlive.diy/unreadable/v1'

export type StoredRead =
  { kind: 'empty' } | { kind: 'ok'; file: PlanFile } | { kind: 'unreadable'; problems: string[] }

/**
 * Read what this browser is holding.
 *
 * The unreadable case is the one that matters. Silently starting fresh would
 * show somebody the landing page as though they had never used this, and then
 * overwrite whatever was there on their first edit. So it is set aside under
 * its own key first, where the storage page lists it and the erase button can
 * still remove it, and the caller is told.
 */
export function readStoredFile(): StoredRead {
  const stored = safeRead(STORAGE_KEY)
  if (stored === null) return { kind: 'empty' }
  const parsed = parsePlanFile(stored)
  if (parsed.ok) return { kind: 'ok', file: parsed.value }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw !== null) window.localStorage.setItem(UNREADABLE_KEY, raw)
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do beyond telling the user, which the caller does.
  }
  invalidate()
  return { kind: 'unreadable', problems: parsed.problems }
}

export function writeStoredFile(file: PlanFile): void {
  safeWrite(STORAGE_KEY, file)
}

export function clearStoredFile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do; the erase button reports what it could not remove.
  }
  invalidate()
}

// --- what is stored here, as an external store ---------------------------
//
// The page that lists everything this origin holds has to read the browser
// rather than a copy this app keeps, or it would be reporting its own
// intentions instead of the facts. React reads external state through
// useSyncExternalStore, so the read is cached and invalidated on every write
// rather than run during render.

export interface StoredKey {
  key: string
  bytes: number
}

const EMPTY: StoredKey[] = []
const listeners = new Set<() => void>()
let cached: StoredKey[] | null = null

function invalidate(): void {
  cached = null
  for (const listener of listeners) listener()
}

function readKeys(): StoredKey[] {
  const keys: StoredKey[] = []
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key === null) continue
      keys.push({ key, bytes: (window.localStorage.getItem(key) ?? '').length })
    }
  } catch {
    return EMPTY
  }
  return keys
}

export function subscribeStorage(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', invalidate)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', invalidate)
  }
}

export function storedKeysSnapshot(): StoredKey[] {
  if (cached === null) cached = readKeys()
  return cached
}

/** The prerendered document has no storage, and says so rather than guessing. */
export function storedKeysServerSnapshot(): StoredKey[] {
  return EMPTY
}

export function eraseEverything(): void {
  for (const { key } of storedKeysSnapshot()) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Whatever could not be removed still shows in the list afterwards.
    }
  }
  invalidate()
}

/** The optional vendor data file, kept apart from the plan because it is not one. */
export function readVendorData(): unknown {
  return safeRead(VENDOR_KEY)
}

export function writeVendorData(data: unknown): void {
  if (data === null) {
    try {
      window.localStorage.removeItem(VENDOR_KEY)
    } catch {
      // Nothing to do; the storage list shows what remains.
    }
    invalidate()
    return
  }
  safeWrite(VENDOR_KEY, data)
}

export function makeFile(plans: Plan[], activePlanId: string | null): PlanFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: GENERATOR,
    savedAt: today(),
    plans,
    activePlanId,
  }
}

/**
 * Save to disk.
 *
 * Uses the file picker where the browser has one, so that "save" means the same
 * thing it means in every other program, and falls back to a download
 * otherwise. Neither path touches the network: a blob URL is a handle to bytes
 * already in this tab.
 */
export async function saveToDisk(
  file: PlanFile,
  suggestedName: string
): Promise<'saved' | 'cancelled'> {
  const json = `${JSON.stringify(file, null, 2)}\n`
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: unknown) => Promise<{
        createWritable: () => Promise<{
          write: (data: string) => Promise<void>
          close: () => Promise<void>
        }>
      }>
    }
  ).showSaveFilePicker

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName,
        types: [{ description: 'outlive.diy plan', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(json)
      await writable.close()
      return 'saved'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Fall through to the download path.
    }
  }

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = suggestedName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return 'saved'
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(file)
  })
}

export function suggestedFilename(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'plan'
  return `${slug}-${today()}.json`
}
