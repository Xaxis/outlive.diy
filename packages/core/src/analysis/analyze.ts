/**
 * The orchestrator. One entry point, one pass, one report.
 *
 * Order matters in exactly one place: compromise runs before correlation so
 * that a person already reported as able to spend is not reported a second time
 * as able to reach a quorum of backups. Everything else is independent.
 */

import type { Id, IsoDate, Plan } from '../model/types.ts'
import { referentialProblems } from '../model/schema.ts'
import type { AnalysisOptions } from './context.ts'
import { createContext } from './context.ts'
import { evaluateWallet, type WalletAvailability } from './availability.ts'
import { analyseStructure } from './structure.ts'
import { analyseLoss } from './loss.ts'
import { analyseCompromise } from './compromise.ts'
import { analyseCorrelation } from './correlation.ts'
import { analyseCoercion } from './coercion.ts'
import { analyseSuccession } from './succession.ts'
import { analyseStaleness } from './staleness.ts'
import { countBySeverity, sortFindings, type Finding, type Severity } from './findings.ts'
import { buildMap, type QuorumMap } from './map.ts'
import { enumerateScenarios, runScenario, type ScenarioResult } from './scenarios.ts'

export interface AnalysisReport {
  planId: Id
  planName: string
  generatedOn: IsoDate
  findings: Finding[]
  counts: Record<Severity, number>
  /** Where each wallet stands today, with nothing wrong. */
  today: { walletId: Id; availability: WalletAvailability }[]
  map: QuorumMap
  scenarios: ScenarioResult[]
  /**
   * References that point at nothing. A file problem rather than a custody
   * problem, kept separate so that the two are never confused.
   */
  brokenReferences: string[]
}

export interface AnalyzeOptions extends Partial<AnalysisOptions> {
  today?: IsoDate
  /** Scenario running is the expensive part; skip it for a fast summary. */
  includeScenarios?: boolean
}

export function analyze(plan: Plan, options: AnalyzeOptions = {}): AnalysisReport {
  const ctx = createContext(plan, options)

  const compromise = analyseCompromise(ctx)
  const findings = sortFindings([
    ...analyseStructure(ctx),
    ...analyseLoss(ctx),
    ...compromise.findings,
    ...analyseCorrelation(ctx, { spendingPeople: compromise.spendingPeople }),
    ...analyseCoercion(ctx),
    ...analyseSuccession(ctx),
    ...analyseStaleness(ctx),
  ])

  return {
    planId: plan.id,
    planName: plan.name,
    generatedOn: ctx.today,
    findings,
    counts: countBySeverity(findings),
    today: plan.wallets.map((wallet) => ({
      walletId: wallet.id,
      availability: evaluateWallet(plan, wallet, ctx.base),
    })),
    map: buildMap(ctx),
    scenarios:
      options.includeScenarios === false
        ? []
        : enumerateScenarios(ctx).map((scenario) => runScenario(ctx, scenario)),
    brokenReferences: referentialProblems(plan),
  }
}

/** Findings that concern a given entity, for the inspector panels. */
export function findingsFor(report: AnalysisReport, type: string, id: Id): Finding[] {
  return report.findings.filter((finding) =>
    finding.subjects.some((subject) => subject.type === type && subject.id === id)
  )
}
