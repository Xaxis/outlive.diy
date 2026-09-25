'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import {
  createContext,
  enumerateScenarios,
  type AnalysisReport,
  type Plan,
  type Ref,
} from '@outlive/core'
import { navigation } from '@/components/shell/Sidebar.tsx'
import { SEVERITY_LABEL } from '@/components/ui/Severity.tsx'
import { navigateTo, type ViewId } from '@/lib/router.ts'
import { SECTIONS, SECTION_FOR } from '@/lib/sections.ts'
import { useStore } from '@/lib/store.ts'
import { cn } from '@/lib/cn.ts'

/**
 * Go anywhere by typing its name.
 *
 * The plan has ten views, seven design steps, twenty-odd worlds, as many
 * findings and every place, person, device, key and wallet it describes, and
 * each of them used to be two or three clicks through a different menu. The
 * palette puts all of them behind one shortcut. It only moves you: nothing
 * here edits the plan, so a slip of the finger costs a back button.
 *
 * Opened with Cmd-K or Ctrl-K, or with the button in the top bar, which sends
 * `OPEN_PALETTE` rather than holding a reference to this component.
 */

export const OPEN_PALETTE = 'outlive:open-palette'

interface Entry {
  id: string
  group: string
  label: string
  hint?: string
  /** Breaks ties between equally good matches: a critical before a medium. */
  rank?: number
  run: () => void
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const

/** How many results are listed before the rest are left to a longer query. */
const LIMIT = 40

export function CommandPalette({ plan, report }: { plan: Plan; report: AnalysisReport | null }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE, onOpen)
    }
  }, [])

  // Mounted only while open, so the worlds are enumerated when somebody asks
  // and not on every keystroke in a field somewhere else.
  return open ? <Palette plan={plan} report={report} onClose={() => setOpen(false)} /> : null
}

function Palette({
  plan,
  report,
  onClose,
}: {
  plan: Plan
  report: AnalysisReport | null
  onClose: () => void
}) {
  const select = useStore((state) => state.select)
  const save = useStore((state) => state.save)
  const undo = useStore((state) => state.undo)
  const theme = useStore((state) => state.preferences.theme)
  const setTheme = useStore((state) => state.setTheme)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  // Where focus was, so closing puts the reader back where they were.
  const returnTo = useRef<Element | null>(
    typeof document === 'undefined' ? null : document.activeElement
  )

  useEffect(() => {
    input.current?.focus()
    const previous = returnTo.current
    return () => (previous as HTMLElement | null)?.focus?.({ preventScroll: true })
  }, [])

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    const go = (view: ViewId, section?: string) => () => navigateTo(view, section)

    for (const group of navigation(report, 0)) {
      for (const item of group.items) {
        out.push({ id: `view:${item.view}`, group: 'Go to', label: item.label, run: go(item.view) })
      }
    }
    // The things people open a palette to do, not only places to go.
    const actions: [string, string, () => void][] = [
      ['build', 'Build a new plan', go('build')],
      ['checkin', 'Check in: do the checks that are due', go('checkin')],
      ['save', 'Save this plan to a file', () => void save()],
      ['print', 'Print this view', () => window.setTimeout(() => window.print(), 50)],
      ['undo', 'Undo the last change', undo],
      [
        'theme',
        theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme',
        () => setTheme(theme === 'light' ? 'dark' : 'light'),
      ],
    ]
    for (const [id, label, run] of actions) out.push({ id: `do:${id}`, group: 'Do', label, run })

    SECTIONS.forEach((section, position) => {
      out.push({
        id: `step:${section.id}`,
        group: 'Describe',
        label: section.label,
        hint: `step ${position + 1} of ${SECTIONS.length}`,
        run: go('design', section.id),
      })
    })

    const open = (ref: Ref) => () => {
      select(ref)
      navigateTo('design', SECTION_FOR[ref.type])
    }
    const things: [Ref['type'], { id: string; label: string }[], string][] = [
      ['location', plan.locations, 'place'],
      ['person', plan.people, 'person'],
      ['device', plan.devices, 'device'],
      ['key', plan.keys, 'key'],
      ['wallet', plan.wallets, 'wallet'],
    ]
    for (const [type, items, noun] of things) {
      for (const item of items) {
        out.push({
          id: `${type}:${item.id}`,
          group: 'In this plan',
          label: item.label,
          hint: noun,
          run: open({ type, id: item.id } as Ref),
        })
      }
    }

    for (const scenario of enumerateScenarios(createContext(plan))) {
      out.push({
        id: `world:${scenario.id}`,
        group: 'Draw a world',
        label: scenario.label,
        hint: scenario.question,
        run: go('map', scenario.id),
      })
    }

    for (const finding of report?.findings ?? []) {
      out.push({
        id: `finding:${finding.id}`,
        group: 'Findings',
        label: finding.title,
        hint: `${finding.rule} · ${SEVERITY_LABEL[finding.severity]}`,
        rank: SEVERITY_RANK[finding.severity],
        run: go('findings', finding.id),
      })
    }
    return out
  }, [plan, report, select, save, undo, theme, setTheme])

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0)
      return entries.filter((entry) => entry.group === 'Go to' || entry.group === 'Do')
    // Every word typed has to begin a word of the entry, so "site a" finds
    // Site A and not every entry with an a in it. The group's name counts too,
    // so "world" or "finding" narrows to one kind, but only for a word long
    // enough to mean that rather than to be the "a" in "Draw a world".
    const scored = entries
      .map((entry) => {
        const own = `${entry.label} ${entry.hint ?? ''}`.toLowerCase().split(/[^a-z0-9]+/)
        const group = entry.group.toLowerCase().split(/[^a-z0-9]+/)
        const hit = (word: string) =>
          own.some((part) => part.startsWith(word)) ||
          (word.length >= 3 && group.some((part) => part.startsWith(word)))
        if (!words.every(hit)) return null
        const label = entry.label.toLowerCase()
        // A name that starts with what was typed beats one that merely
        // contains it, and a short name beats a long one.
        const score =
          (label.startsWith(query.trim().toLowerCase()) ? 0 : label.startsWith(words[0]) ? 1 : 2) *
            1000 +
          (entry.rank ?? 0) * 100 +
          Math.min(label.length, 99)
        return { entry, score }
      })
      .filter((item): item is { entry: Entry; score: number } => item !== null)
    // Stable within a group, so worlds stay in the engine's order.
    return scored
      .sort((a, b) => a.score - b.score)
      .slice(0, LIMIT)
      .map((item) => item.entry)
  }, [entries, query])

  const active = Math.min(cursor, Math.max(0, results.length - 1))

  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  const choose = (entry: Entry | undefined) => {
    if (!entry) return
    onClose()
    entry.run()
  }

  // Results arrive sorted by score, which interleaves groups. Shown grouped,
  // in the order each group first appears, so the best match still leads.
  const grouped: { group: string; items: { entry: Entry; index: number }[] }[] = []
  results.forEach((entry, index) => {
    const found = grouped.find((bucket) => bucket.group === entry.group)
    if (found) found.items.push({ entry, index })
    else grouped.push({ group: entry.group, items: [{ entry, index }] })
  })
  const order = grouped.flatMap((bucket) => bucket.items)

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor(Math.min(results.length - 1, active + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor(Math.max(0, active - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(order[active]?.entry)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center bg-[rgb(0_0_0/0.55)] p-4 pt-[12vh] backdrop-blur-sm no-print"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Go to"
        className="panel palette-in w-full max-w-xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <Search className="size-4 flex-none text-faint" aria-hidden />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={order[active] ? `palette-${active}` : undefined}
            aria-label="Go to a view, a step, a world, a finding or anything in the plan"
            placeholder="Go to a view, a world, a finding, a key…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            onKeyDown={onKeyDown}
            // Inline, because the global focus ring is unlayered and so beats
            // any utility. The field is the whole dialog; a ring inside it
            // marks nothing the open dialog does not already.
            style={{ outline: 'none' }}
            className="h-12 min-w-0 flex-1 bg-transparent text-[0.9375rem] text-strong placeholder:text-faint"
          />
          <kbd className="mono rounded border border-line px-1.5 text-[0.625rem] text-faint">
            esc
          </kbd>
        </div>

        <ul
          ref={list}
          id="palette-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[min(26rem,60vh)] overflow-y-auto p-1.5"
        >
          {grouped.length === 0 ? (
            <li className="px-2.5 py-6 text-center text-sm text-muted">
              Nothing in this plan is called that.
            </li>
          ) : null}
          {grouped.map((bucket) => (
            <li key={bucket.group} role="presentation">
              <p className="eyebrow px-2.5 pb-1 pt-2">{bucket.group}</p>
              <ul role="presentation">
                {bucket.items.map(({ entry }) => {
                  const position = order.findIndex((item) => item.entry.id === entry.id)
                  const current = position === active
                  return (
                    <li
                      key={entry.id}
                      id={`palette-${position}`}
                      data-index={position}
                      role="option"
                      aria-selected={current}
                      onMouseMove={() => setCursor(position)}
                      onClick={() => choose(entry)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-1.5',
                        current ? 'bg-accent/10 text-strong' : 'text-body'
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
                        {entry.label}
                      </span>
                      {entry.hint ? (
                        <span
                          className={cn(
                            'max-w-[45%] flex-none truncate text-[0.6875rem]',
                            current ? 'text-muted' : 'text-faint'
                          )}
                        >
                          {entry.hint}
                        </span>
                      ) : null}
                      {current ? (
                        <CornerDownLeft className="size-3 flex-none text-accent" aria-hidden />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
