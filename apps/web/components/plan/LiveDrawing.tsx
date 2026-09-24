'use client'

import { useMemo } from 'react'
import { baseWorld, buildGraph, type EntityType, type Plan, type Ref } from '@outlive/core'
import { DiagramOmissions, PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { SectionHeading } from '@/components/ui/Surface.tsx'
import { useStore } from '@/lib/store.ts'
import { navigateTo } from '@/lib/router.ts'
import { SECTION_FOR } from '@/lib/sections.ts'

/**
 * The plan, drawn while it is being described.
 *
 * Describing a custody setup is seven forms, and a form says nothing about
 * shape: that a key and its only backup ended up in the same place is a fact
 * about two dropdowns on two different screens. The drawing has it in one
 * glance. So it sits above the editor, redraws on every keystroke, and holds
 * lit whatever is being edited together with everything connected to it.
 * Above rather than under, because an inspector for a key runs to a screen
 * and a half, and a picture below that is one nobody sees while the fields
 * that change it are in view.
 *
 * People are always drawn. Leaving them out would have the drawing report
 * them as described-but-unreached, which is false and reads as lost data.
 *
 * Clicking a box opens that thing for editing, on its own step. A backup and a
 * spend path are edited inside what owns them, so a click on one of those opens
 * the owner instead, which is the same rule the map follows.
 */

/** Which kinds are edited as themselves rather than inside something else. */
const OWNS_ITSELF: EntityType[] = ['location', 'person', 'device', 'key', 'wallet']

export function LiveDrawing({ plan }: { plan: Plan }) {
  const selection = useStore((state) => state.selection)
  const select = useStore((state) => state.select)

  const graph = useMemo(
    () =>
      plan.wallets.length > 0 ? buildGraph(plan, baseWorld(plan), { includePeople: true }) : null,
    [plan]
  )

  const selectedId = useMemo(() => {
    if (!graph || !selection) return null
    return (
      graph.nodes.find((node) => node.ref?.type === selection.type && node.ref.id === selection.id)
        ?.id ?? null
    )
  }, [graph, selection])

  if (!graph || graph.nodes.length === 0) {
    // Said rather than left blank. Places and keys already described with no
    // drawing above them reads as the drawing having failed.
    const described = plan.locations.length + plan.devices.length + plan.keys.length
    if (described === 0) return null
    return (
      <p className="card mb-4 px-4 py-3 text-xs leading-relaxed text-muted no-print">
        Nothing is drawn yet. The drawing starts at the wallets and walks down to what each one
        rests on, so it appears once a wallet has a way to be spent.
      </p>
    )
  }

  /** The thing a click should open: the box itself, or whatever it belongs to. */
  const owner = (nodeId: string): Ref | null => {
    let current = nodeId
    // Up the graph towards the wallets until something is edited as itself.
    for (let step = 0; step < 4; step++) {
      const node = graph.nodes.find((entry) => entry.id === current)
      if (node?.ref && OWNS_ITSELF.includes(node.ref.type)) return node.ref
      const parent = graph.edges.find((edge) => edge.to === current)
      if (!parent) return null
      current = parent.from
    }
    return null
  }

  return (
    <div className="card mb-4 p-4 no-print">
      <SectionHeading
        title="Where this sits"
        hint={
          selectedId
            ? 'The one you are editing is lit, with everything connected to it. Click any box to edit that instead.'
            : 'The plan as described so far, redrawn as you type. Click any box to edit it.'
        }
      />
      <PlanDiagram
        graph={graph}
        height="18rem"
        selectedId={selectedId}
        onSelectNode={(id) => {
          const ref = owner(id)
          if (!ref) return
          select(ref)
          navigateTo('design', SECTION_FOR[ref.type])
        }}
      />
      <div className="mt-2">
        <DiagramOmissions graph={graph} />
      </div>
    </div>
  )
}
