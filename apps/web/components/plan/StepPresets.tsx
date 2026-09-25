'use client'

import { Sparkles } from 'lucide-react'
import { presetsFor, type Plan, type PresetStep } from '@outlive/core'
import { useStore } from '@/lib/store.ts'
import { cn } from '@/lib/cn.ts'

/**
 * The usual answer to a step, in one click.
 *
 * Each is a preset from the engine, so what it adds is tested there: whole,
 * guard-clean, and in roles rather than names. It only ever adds, and it is
 * one undo step, so trying one costs nothing.
 */
export function StepPresets({ plan, step }: { plan: Plan; step: PresetStep }) {
  const edit = useStore((state) => state.edit)
  const notify = useStore((state) => state.notify)
  const presets = presetsFor(step)
  if (presets.length === 0) return null

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-1.5 no-print"
      role="group"
      aria-label="Start from"
    >
      <span className="mr-1 flex items-center gap-1 text-xs text-faint">
        <Sparkles className="size-3.5 text-accent" aria-hidden />
        Start from
      </span>
      {presets.map((preset) => {
        const blocked = preset.blocked(plan)
        return (
          <button
            key={preset.id}
            type="button"
            disabled={blocked !== null}
            title={blocked ?? preset.detail}
            onClick={() => {
              useStore.setState({ lastEditAt: 0 })
              edit((draft) => preset.apply(draft))
              notify({
                tone: 'ok',
                message: preset.label,
                detail: preset.detail,
                undoable: true,
              })
            }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              blocked
                ? 'cursor-not-allowed border-dashed border-line text-faint'
                : 'border-accent/40 bg-accent/[0.06] text-body hover:border-accent hover:text-strong'
            )}
          >
            {preset.label}
            {blocked ? <span className="sr-only"> ({blocked})</span> : null}
          </button>
        )
      })}
    </div>
  )
}
