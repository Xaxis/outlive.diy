'use client'

import { useEffect } from 'react'
import { useStore } from './store.ts'

/**
 * The three shortcuts an editor is expected to have.
 *
 * Save is bound because this application's model of ownership is a file the
 * user keeps, and a save that needs a mouse is a save people skip. Undo and
 * redo are bound because every field writes to the plan the moment it is
 * valid, and that is only comfortable if the last change is always reversible.
 */
export function useShortcuts(): void {
  const undo = useStore((state) => state.undo)
  const redo = useStore((state) => state.redo)
  const save = useStore((state) => state.save)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void save()
        return
      }
      if (key === 'z') {
        // A text field's own undo stack is more useful inside that field.
        const target = event.target as HTMLElement | null
        if (target && /^(input|textarea)$/i.test(target.tagName)) return
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, save])
}

/**
 * Warn before closing a tab that is holding the only copy.
 *
 * Only in memory-only mode, and only with unsaved changes. In the default mode
 * the plan is in local storage and closing the tab costs nothing, so a warning
 * there would be the kind of prompt people learn to dismiss without reading.
 */
export function useUnsavedWarning(): void {
  const dirty = useStore((state) => state.dirty)
  const persistence = useStore((state) => state.preferences.persistence)

  useEffect(() => {
    if (persistence !== 'memory' || !dirty) return
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty, persistence])
}
