/**
 * @outlive/core
 *
 * The model, the analysis engine, the input guard and the document generators.
 * No React, no DOM, no storage, no network. Everything the browser front end
 * shows is computed here, which is what makes the front end replaceable and the
 * engine testable.
 */

export * from './model/types.ts'
export * from './model/factory.ts'
export * from './model/schema.ts'
export * from './model/selectors.ts'
export * from './model/examples.ts'

export * from './guard/guard.ts'

export * from './analysis/availability.ts'
export * from './analysis/context.ts'
export * from './analysis/findings.ts'
export * from './analysis/scenarios.ts'
export * from './analysis/map.ts'
export * from './analysis/analyze.ts'
export { successionBrief, requiredSkill, heirs } from './analysis/succession.ts'
export { overdueVerifications, describeKind } from './analysis/staleness.ts'

export * from './documents/runbook.ts'
export * from './documents/recovery.ts'
export * from './documents/successor-letter.ts'

export * from './diff/compare.ts'
export * from './vendors/vendors.ts'
