'use client'

import { useState } from 'react'
import type { Plan } from '@outlive/core'
import { Segmented } from '@/components/ui/Field.tsx'
import { PlacementGrid } from '@/components/plan/PlacementGrid.tsx'
import { LiveDrawing } from '@/components/plan/LiveDrawing.tsx'

/**
 * The grid and the drawing, one at a time.
 *
 * Each step showed both, stacked, above the editor they describe, and the
 * wallets step added a third picture below it. That was a page of pictures
 * with a form somewhere under them. Now it is one panel: the grid where the
 * grid is what you edit, the drawing where the shape is the point, and a way
 * to put both away. The choice is the reader's and it is remembered for the
 * visit, not written to the plan.
 */
type Showing = 'grid' | 'drawing' | 'none'

let remembered: Showing | null = null

export function StepVisual({ plan, preferDrawing }: { plan: Plan; preferDrawing: boolean }) {
  const [showing, setShowing] = useState<Showing>(
    remembered ?? (preferDrawing ? 'drawing' : 'grid')
  )
  const choose = (next: Showing) => {
    remembered = next
    setShowing(next)
  }
  if (plan.locations.length === 0 && plan.wallets.length === 0) return null

  return (
    <div className="mb-4 no-print">
      <Segmented
        value={showing}
        onChange={choose}
        className="mb-2"
        options={[
          { value: 'grid', label: 'What goes where' },
          { value: 'drawing', label: 'Drawing' },
          { value: 'none', label: 'Hide' },
        ]}
      />
      {showing === 'grid' ? <PlacementGrid plan={plan} /> : null}
      {showing === 'drawing' ? <LiveDrawing plan={plan} /> : null}
    </div>
  )
}
