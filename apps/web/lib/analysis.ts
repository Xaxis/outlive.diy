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
 * Scenarios are kept apart from the report because the whole set is
 * quadratic-ish in the size of the plan and most views do not need it.
 *
 * One analysis per plan object, shared by everything on the page.
 *
 * A memo inside each hook meant every component asking for the report ran the
 * whole analysis again: the shell for the sidebar count, the step for its
 * readback, the grid for its counts. On a keystroke that was four full runs.
 * The plan is immutable, a new object on every edit, so the object itself is
 * the cache key and a weak map lets old ones go.
 */
const reports = new WeakMap<Plan, AnalysisReport>()
const worlds = new WeakMap<Plan, ScenarioResult[]>()

export function reportFor(plan: Plan): AnalysisReport {
  let report = reports.get(plan)
  if (!report) {
    report = analyze(plan, { includeScenarios: false })
    reports.set(plan, report)
  }
  return report
}

export function scenarioResultsFor(plan: Plan): ScenarioResult[] {
  let results = worlds.get(plan)
  if (!results) {
    const ctx = createContext(plan)
    results = enumerateScenarios(ctx).map((scenario) => runScenario(ctx, scenario))
    worlds.set(plan, results)
  }
  return results
}

export function useReport(plan: Plan | null): AnalysisReport | null {
  return useMemo(() => (plan ? reportFor(plan) : null), [plan])
}

export function useScenarioResults(plan: Plan | null): ScenarioResult[] {
  return useMemo(() => (plan ? scenarioResultsFor(plan) : []), [plan])
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
