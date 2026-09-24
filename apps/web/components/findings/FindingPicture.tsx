'use client'

import { useMemo } from 'react'
import {
  baseWorld,
  buildGraph,
  createContext,
  enumerateScenarios,
  type Finding,
  type Plan,
} from '@outlive/core'
import { PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { navigateTo } from '@/lib/router.ts'

/**
 * The finding, drawn, inside the finding.
 *
 * A finding names what breaks and the map draws where. Reading one used to
 * mean leaving the list for the map and finding your way back, which is how a
 * reader ends up reading the first three findings and none of the rest. So an
 * open finding carries its own picture: the world it came out of, with the
 * things it is about tagged. A finding with no world of its own, a structure
 * or staleness rule, is drawn as the plan stands.
 *
 * Only mounted while the finding is open, because twenty-four drawings for a
 * list most of which stays shut is a page that takes a second to scroll.
 */
export function FindingPicture({ plan, finding }: { plan: Plan; finding: Finding }) {
  const graph = useMemo(() => {
    const scenario = finding.scenarioId
      ? (enumerateScenarios(createContext(plan)).find((entry) => entry.id === finding.scenarioId) ??
        null)
      : null
    const graph = buildGraph(plan, scenario?.world ?? baseWorld(plan), { includePeople: true })
    return graph.nodes.length > 0 ? graph : null
  }, [plan, finding.scenarioId])

  const marked = useMemo(
    () => ({ ids: new Set(finding.subjects.map((subject) => subject.id)), label: 'this' }),
    [finding.subjects]
  )

  if (!graph) return null

  return (
    <figure className="no-print mt-3">
      <PlanDiagram
        graph={graph}
        height="17rem"
        marked={marked}
        // Anywhere on the picture goes to the map, in the same world, where
        // the box can be taken apart. The picture here is for reading.
        onSelectNode={() => navigateTo('map', finding.scenarioId ?? undefined)}
      />
      <figcaption className="mt-1.5 text-[0.6875rem] leading-relaxed text-faint">
        {finding.world
          ? `Drawn in the world it came from: ${finding.world}. `
          : 'Drawn as the plan stands. '}
        Tagged: what this finding is about. Click the drawing to take it apart on the map.
      </figcaption>
    </figure>
  )
}
