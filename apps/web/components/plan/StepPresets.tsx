'use client'

import { Sparkles } from 'lucide-react'
import { presetsFor, type Plan, type PresetStep } from '@outlive/core'
import { entitiesOf, useStore, type EntityKind } from '@/lib/store.ts'
import { cn } from '@/lib/cn.ts'

/**
 * The usual answer to a step, in one click.
 *
 * Each is a preset from the engine, so what it adds is tested there: whole,
 * guard-clean, and in roles rather than names. It only ever adds, and it is
 * one undo step, so trying one costs nothing. One that needs something first
 * still answers a tap, with what it needs, because a greyed button with the
 * reason in a tooltip says nothing on a phone.
 */

const KIND: Record<PresetStep, EntityKind | null> = {
  profile: null,
  locations: 'location',
  people: 'person',
  devices: 'device',
  keys: 'key',
  wallets: 'wallet',
  checks: 'verification',
}
export function StepPresets({ plan, step }: { plan: Plan; step: PresetStep }) {
  const edit = useStore((state) => state.edit)
  const notify = useStore((state) => state.notify)
  const select = useStore((state) => state.select)
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
            aria-disabled={blocked !== null}
            title={blocked ?? preset.detail}
            onClick={() => {
              if (blocked) {
                notify({
                  tone: 'warn',
                  message: `${preset.label} needs something first`,
                  detail: blocked,
                })
                return
              }
              const kind = KIND[step]
              const before = new Set(kind ? entitiesOf(plan, kind).map((entry) => entry.id) : [])
              useStore.setState({ lastEditAt: 0 })
              edit((draft) => preset.apply(draft))
              notify({
                tone: 'ok',
                message: preset.label,
                detail: preset.detail,
                undoable: true,
              })
              // Open the first thing it added, so the result is in front of
              // the reader rather than somewhere down a list.
              const state = useStore.getState()
              const now = state.plans.find((entry) => entry.id === state.activeId)
              const added =
                kind && now ? entitiesOf(now, kind).find((entry) => !before.has(entry.id)) : null
              if (kind && added) select({ type: kind, id: added.id })
            }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              blocked
                ? 'border-dashed border-line text-faint hover:text-muted'
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
