'use client'

import { useState } from 'react'
import {
  Check,
  ChevronDown,
  HardDriveDownload,
  Menu,
  MonitorCog,
  Moon,
  Redo2,
  Save,
  Sun,
  Undo2,
} from 'lucide-react'
import type { Plan } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { Wordmark } from '@/components/brand/Logo.tsx'
import { useStore } from '@/lib/store.ts'
import { href } from '@/lib/router.ts'
import { cn } from '@/lib/cn.ts'

function PlanSwitcher({ plans, activeId }: { plans: Plan[]; activeId: string }) {
  const setActive = useStore((state) => state.setActive)
  const [open, setOpen] = useState(false)
  const active = plans.find((plan) => plan.id === activeId)
  if (!active) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-0 max-w-[9rem] items-center gap-1.5 rounded-[var(--radius-control)] border border-line px-2 py-1 text-xs text-body transition-colors hover:border-line-strong sm:max-w-[16rem]"
        aria-expanded={open}
      >
        <span className="truncate">{active.name}</span>
        {active.kind === 'draft' ? (
          <span className="chip hidden border-accent/50 text-accent sm:inline-flex">draft</span>
        ) : null}
        <ChevronDown className="size-3.5 flex-none text-faint" aria-hidden />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close plan list"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul className="panel absolute left-0 top-full z-20 mt-1 max-h-72 w-72 overflow-y-auto p-1">
            {plans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(plan.id)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-left text-xs transition-colors hover:bg-[rgb(var(--tint)/0.06)]"
                >
                  <Check
                    className={cn(
                      'size-3.5 flex-none',
                      plan.id === activeId ? 'text-accent' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-body">{plan.name}</span>
                  <span className="text-faint">{plan.kind === 'draft' ? 'draft' : 'current'}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function ThemeToggle() {
  const theme = useStore((state) => state.preferences.theme)
  const setTheme = useStore((state) => state.setTheme)
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : MonitorCog

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme}. Switch to ${next}.`}
      onClick={() => {
        setTheme(next)
        const resolved =
          next === 'system'
            ? window.matchMedia('(prefers-color-scheme: light)').matches
              ? 'light'
              : 'dark'
            : next
        document.documentElement.setAttribute('data-theme', resolved)
      }}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  )
}

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const plans = useStore((state) => state.plans)
  const activeId = useStore((state) => state.activeId)
  const persistence = useStore((state) => state.preferences.persistence)
  const undo = useStore((state) => state.undo)
  const redo = useStore((state) => state.redo)
  const canUndo = useStore((state) => state.past.length > 0)
  const canRedo = useStore((state) => state.future.length > 0)
  const save = useStore((state) => state.save)

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur no-print">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2 sm:gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          aria-label="Toggle navigation"
          onClick={onToggleSidebar}
        >
          <Menu className="size-4" aria-hidden />
        </Button>

        <a href={href('overview')} className="no-underline" aria-label="outlive.diy, home">
          <Wordmark />
        </a>

        {plans.length > 0 ? (
          <>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <PlanSwitcher plans={plans} activeId={activeId} />
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {plans.length > 0 ? (
            <>
              <a
                href={href('file')}
                className="chip hidden no-underline transition-colors hover:border-line-strong sm:inline-flex"
                title="Where this plan is stored"
              >
                <HardDriveDownload className="size-3" aria-hidden />
                {persistence === 'local' ? 'in this browser' : 'in memory only'}
              </a>
              {/* On a phone there is no keyboard shortcut to fall back on, but
                  there is also no room in the row. Saving is the one that has
                  to survive, so undo and redo stand down first. */}
              <span className="hidden items-center gap-1 sm:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={!canUndo}
                  aria-label="Undo"
                >
                  <Undo2 className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={!canRedo}
                  aria-label="Redo"
                >
                  <Redo2 className="size-4" aria-hidden />
                </Button>
              </span>
              <Button
                variant="default"
                size="sm"
                onClick={() => void save()}
                icon={<Save className="size-3.5" aria-hidden />}
              >
                Save
              </Button>
            </>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
