'use client'

import { useSyncExternalStore } from 'react'

/**
 * The reader's Anthropic key, kept apart from everything else.
 *
 * Not in the plan store, on purpose: that store is snapshotted for undo,
 * written to local storage as the plan file and exported as a file people
 * hand to others, and a key must be in none of those. It lives in this
 * module's memory and is gone when the tab closes, unless the reader asks for
 * it to be remembered in this browser, which is said to them in so many words.
 * Erasing local data erases it with everything else.
 */

const STORED = 'outlive.diy/claude-key/v1'

let key: string | null = null
let remembered = false
let loaded = false
const listeners = new Set<() => void>()

function load(): void {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const stored = window.localStorage.getItem(STORED)
    if (stored) {
      key = stored
      remembered = true
    }
  } catch {
    // No storage, no remembered key.
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function setClaudeKey(next: string, remember: boolean): void {
  key = next.trim() || null
  remembered = remember && key !== null
  try {
    if (remembered && key) window.localStorage.setItem(STORED, key)
    else window.localStorage.removeItem(STORED)
  } catch {
    remembered = false
  }
  emit()
}

export function forgetClaudeKey(): void {
  key = null
  remembered = false
  try {
    window.localStorage.removeItem(STORED)
  } catch {
    // Nothing stored to remove.
  }
  emit()
}

export function claudeKey(): string | null {
  load()
  return key
}

let snapshot = { key: null as string | null, remembered: false }

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  load()
  if (snapshot.key !== key || snapshot.remembered !== remembered) snapshot = { key, remembered }
  return snapshot
}

const SERVER = { key: null, remembered: false }

export function useClaudeKey(): { key: string | null; remembered: boolean } {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER)
}

/** Enough to recognise a key, never enough to use one. */
export function maskKey(value: string): string {
  return value.length <= 12 ? '••••' : `${value.slice(0, 7)}…${value.slice(-4)}`
}
