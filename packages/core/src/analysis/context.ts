/**
 * What every analysis is handed. Built once per run so that the seven analyses
 * are guaranteed to be looking at the same plan and the same day.
 */

import type { IsoDate, Plan } from '../model/types.ts'
import { indexPlan, type PlanIndex } from '../model/selectors.ts'
import { baseWorld, type World } from './availability.ts'
import { today } from '../model/factory.ts'

export interface AnalysisContext {
  plan: Plan
  index: PlanIndex
  /** The day the analysis is run on. Injectable so tests do not drift. */
  today: IsoDate
  /** Nothing wrong, everything in reach. Every scenario subtracts from this. */
  base: World
  options: AnalysisOptions
}

export interface AnalysisOptions {
  /**
   * Minutes of travel an attacker with a cooperating victim can cover before
   * the event ends. A day of driving, by default; the point is that it is a
   * budget and not infinity.
   */
  coercionTravelMinutes: number
  /** Days assumed to pass before a timelocked inheritance path opens. */
  inheritanceElapsedDays: number
}

export const defaultAnalysisOptions: AnalysisOptions = {
  coercionTravelMinutes: 480,
  inheritanceElapsedDays: 365,
}

export function createContext(
  plan: Plan,
  options: Partial<AnalysisOptions> & { today?: IsoDate } = {}
): AnalysisContext {
  return {
    plan,
    index: indexPlan(plan),
    today: options.today ?? today(),
    base: baseWorld(plan),
    options: { ...defaultAnalysisOptions, ...options },
  }
}
