'use client'

import { useCallback } from 'react'
import type { Plan } from '@outlive/core'
import { entitiesOf, useStore, type EntityKind } from './store.ts'

/** Patch one entity in the active plan, with undo. */
export function useEntityUpdater(kind: EntityKind) {
  const edit = useStore((state) => state.edit)
  return useCallback(
    (id: string, patch: Record<string, unknown>) => {
      edit((plan) => {
        const found = entitiesOf(plan, kind).find((entity) => entity.id === id)
        if (found) Object.assign(found, patch)
      })
    },
    [edit, kind]
  )
}

/** Free-form edit of the active plan, for changes that touch several entities. */
export function usePlanEdit(): (recipe: (plan: Plan) => void) => void {
  return useStore((state) => state.edit)
}
