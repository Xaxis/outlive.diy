'use client'

import { useMemo, useState } from 'react'
import {
  baseWorld,
  createContext,
  enumerateScenarios,
  type Perspective,
  type Plan,
  type Ref,
  type Scenario,
  type ScenarioKind,
  type World,
} from '@outlive/core'

/**
 * Which world the diagram is drawn in.
 *
 * The value of a picture of a custody plan is not that it shows the plan; it is
 * that you can take one thing away and watch what stops working. Every option
 * here is a scenario the engine already builds, so the diagram cannot show a
 * world the findings list has not also considered.
 */

export const TODAY = 'today'

interface Group {
  label: string
  scenarios: Scenario[]
}

/** Which question each scenario belongs under, in the order they are offered. */
const GROUPS: { label: string; kinds: ScenarioKind[] }[] = [
  {
    label: 'If something is gone',
    kinds: [
      'location-lost',
      'disaster-group-lost',
      'key-lost',
      'device-lost',
      'backup-lost',
      'config-lost',
      'person-lost',
    ],
  },
  {
    label: 'If somebody else is inside',
    kinds: ['location-compromised', 'person-compromised', 'coercion'],
  },
  { label: 'After you', kinds: ['user-death'] },
]

export interface Lens {
  id: string
  world: World
  scenario: Scenario | null
  /** What is being shown, as a sentence. */
  caption: string
  groups: Group[]
  set: (id: string) => void
  /**
   * The scenario that takes one particular thing away, or puts somebody else
   * inside it. Looked up from what the engine enumerated rather than built out
   * of an id, so the picture can only ever offer a world the engine has.
   */
  find: (ref: Ref, perspective: Perspective) => Scenario | null
}

export function useLens(plan: Plan | null, initial?: string | null): Lens {
  const [id, set] = useState<string>(initial ?? TODAY)

  // Arriving from a finding names the world it came out of. Following that link
  // again with a different finding has to change the picture, which a state
  // initialiser alone would not do.
  const [seen, setSeen] = useState<string | null>(initial ?? null)
  if ((initial ?? null) !== seen) {
    setSeen(initial ?? null)
    set(initial ?? TODAY)
  }

  const scenarios = useMemo(() => (plan ? enumerateScenarios(createContext(plan)) : []), [plan])

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        label: group.label,
        scenarios: scenarios.filter((scenario) => group.kinds.includes(scenario.kind)),
      })).filter((group) => group.scenarios.length > 0),
    [scenarios]
  )

  const scenario = scenarios.find((entry) => entry.id === id) ?? null
  const world = useMemo(() => scenario?.world ?? (plan ? baseWorld(plan) : null), [scenario, plan])

  return {
    id: scenario ? id : TODAY,
    world: world!,
    scenario,
    caption: scenario
      ? `${scenario.label}. ${scenario.question}`
      : 'The plan as it stands, with nothing wrong and everything in reach.',
    groups,
    // A lens whose scenario disappeared, because the plan changed under it,
    // falls back to today rather than showing a world that no longer exists.
    set: (next: string) => set(next === TODAY ? TODAY : next),
    find: (ref, perspective) =>
      scenarios.find(
        (entry) =>
          entry.perspective === perspective &&
          entry.subjects.some((subject) => subject.type === ref.type && subject.id === ref.id)
      ) ?? null,
  }
}

export function LensPicker({ lens, id }: { lens: Lens; id: string }) {
  return (
    <select
      id={id}
      className="select max-w-[22rem]"
      value={lens.id}
      onChange={(event) => lens.set(event.target.value)}
    >
      <option value={TODAY}>As it stands</option>
      {lens.groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
