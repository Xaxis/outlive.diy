'use client'

import { useMemo } from 'react'
import {
  analyze,
  buildRunbook,
  createContext,
  enumerateScenarios,
  lettersFor,
  recoveryRoutes,
  runScenario,
  type AnalysisReport,
  type Plan,
  type ScenarioResult,
} from '@outlive/core'

/**
 * The report, recomputed only when the plan object changes.
 *
 * Scenarios are excluded here because the whole set is quadratic-ish in the
 * size of the plan and most views do not need it; the stress test asks for it
 * separately.
 */
export function useReport(plan: Plan | null): AnalysisReport | null {
  return useMemo(() => (plan ? analyze(plan, { includeScenarios: false }) : null), [plan])
}

export function useScenarioResults(plan: Plan | null): ScenarioResult[] {
  return useMemo(() => {
    if (!plan) return []
    const ctx = createContext(plan)
    return enumerateScenarios(ctx).map((scenario) => runScenario(ctx, scenario))
  }, [plan])
}

export function useRunbook(plan: Plan | null) {
  return useMemo(() => (plan ? buildRunbook(plan) : null), [plan])
}

export function useRecovery(plan: Plan | null) {
  return useMemo(() => (plan ? recoveryRoutes(createContext(plan)) : []), [plan])
}

export function useLetters(plan: Plan | null) {
  return useMemo(() => (plan ? lettersFor(createContext(plan)) : []), [plan])
}
