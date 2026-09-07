'use client'

import { Plus } from 'lucide-react'
import { ViewHeader } from '@/components/ui/Surface.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ProfileEditor } from '@/components/plan/ProfileEditor.tsx'
import { EntityWorkbench } from '@/components/plan/EntityWorkbench.tsx'
import { entitiesOf, useActivePlan, useStore } from '@/lib/store.ts'
import { useReport } from '@/lib/analysis.ts'
import { useRoute } from '@/lib/router.ts'
import { SECTIONS, type Section } from '@/lib/sections.ts'
import { cn } from '@/lib/cn.ts'

export function DesignView() {
  const plan = useActivePlan()
  const report = useReport(plan)
  const select = useStore((state) => state.select)
  const addEntity = useStore((state) => state.addEntity)
  const [route, navigate] = useRoute()

  const section = (SECTIONS.find((entry) => entry.id === route.section)?.id ??
    'locations') as Section
  const definition = SECTIONS.find((entry) => entry.id === section)!

  if (!plan) return null

  return (
    <div className="mx-auto max-w-6xl">
      <ViewHeader
        eyebrow="Plan"
        title="Design"
        question={definition.blurb}
        actions={
          definition.kind ? (
            <Button
              variant="primary"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => {
                const id = addEntity(definition.kind!)
                if (id) select({ type: definition.kind!, id })
              }}
            >
              Add
            </Button>
          ) : null
        }
      />

      <nav
        aria-label="Design sections"
        className="mb-5 flex flex-wrap gap-1 border-b border-line pb-2"
      >
        {SECTIONS.map((entry) => {
          const count = entry.kind ? entitiesOf(plan, entry.kind).length : null
          const active = entry.id === section
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                select(null)
                navigate({ view: 'design', section: entry.id })
              }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-[var(--radius-control)] px-2.5 py-1.5 text-[0.8125rem] transition-colors',
                active
                  ? 'bg-accent/10 font-medium text-strong'
                  : 'text-muted hover:bg-[rgb(var(--tint)/0.05)] hover:text-strong'
              )}
            >
              {entry.label}
              {count !== null ? (
                <span className="mono ml-1.5 text-[0.6875rem] text-faint">{count}</span>
              ) : null}
            </button>
          )
        })}
        {definition.kind ? (
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            icon={<Plus className="size-3.5" aria-hidden />}
            onClick={() => {
              const id = addEntity(definition.kind!)
              if (id) select({ type: definition.kind!, id })
            }}
          >
            Add {definition.singular.toLowerCase()}
          </Button>
        ) : null}
      </nav>

      {definition.kind === null ? (
        <ProfileEditor plan={plan} />
      ) : (
        <EntityWorkbench
          plan={plan}
          report={report}
          kind={definition.kind}
          singular={definition.singular}
          plural={definition.label}
          blurb={definition.blurb}
        />
      )}
    </div>
  )
}
