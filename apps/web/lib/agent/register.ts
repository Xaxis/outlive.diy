'use client'

import { AGENT_TOOLS, runTool, type AgentTool } from './tools.ts'

/**
 * Offer the tools to the browser, if it knows how to take them.
 *
 * WebMCP puts `modelContext` on `document` in the current draft and had it on
 * `navigator` in the builds before that, where unregistering was a method
 * rather than an aborted signal. Both are supported so that the feature works
 * in whichever build a reader has, and in a browser with neither this does
 * nothing at all.
 */

interface ModelContext {
  registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => unknown
  unregisterTool?: (name: string) => void
}

export function modelContext(): ModelContext | null {
  const fromDocument = (document as unknown as { modelContext?: ModelContext }).modelContext
  if (fromDocument?.registerTool) return fromDocument
  const fromNavigator = (navigator as unknown as { modelContext?: ModelContext }).modelContext
  return fromNavigator?.registerTool ? fromNavigator : null
}

function describe(tool: AgentTool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    execute: (input: unknown) => runTool(tool, input),
  }
}

/** Register every tool; the returned function takes them all back. */
export function registerAgentTools(): () => void {
  const context = modelContext()
  if (!context) return () => {}
  const controller = new AbortController()
  const registered: string[] = []
  for (const tool of AGENT_TOOLS) {
    try {
      void context.registerTool(describe(tool), { signal: controller.signal })
      registered.push(tool.name)
    } catch {
      // A name registered twice, by a second tab of this page in one browsing
      // context, throws. The first registration still serves.
    }
  }
  return () => {
    controller.abort()
    for (const name of registered) {
      try {
        context.unregisterTool?.(name)
      } catch {
        // Already gone with the aborted signal.
      }
    }
  }
}
