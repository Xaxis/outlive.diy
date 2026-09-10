'use client'

import {
  BookOpenCheck,
  FileJson,
  GitCompareArrows,
  Footprints,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Mail,
  Scale,
  Shapes,
  SlidersHorizontal,
  TableProperties,
} from 'lucide-react'
import type { AnalysisReport } from '@outlive/core'
import { href, type Route, type ViewId } from '@/lib/router.ts'
import { cn } from '@/lib/cn.ts'

interface Item {
  view: ViewId
  label: string
  icon: typeof LayoutGrid
  /** Shown as a small count on the right. */
  badge?: number
  badgeTone?: 'critical' | 'muted'
}

interface Group {
  title: string
  items: Item[]
}

export function navigation(report: AnalysisReport | null, letterCount: number): Group[] {
  const critical = report ? report.counts.critical + report.counts.high : 0
  return [
    {
      title: 'Plan',
      items: [
        { view: 'overview', label: 'Overview', icon: LayoutGrid },
        // The guided route is the same editors in a reasoned order. It stays
        // reachable rather than being a one-time wizard you cannot get back to.
        { view: 'start', label: 'Guided route', icon: Footprints },
        { view: 'design', label: 'Design', icon: SlidersHorizontal },
      ],
    },
    {
      title: 'Diagnosis',
      items: [
        {
          view: 'findings',
          label: 'Findings',
          icon: ListChecks,
          badge: report?.findings.length,
          badgeTone: critical > 0 ? 'critical' : 'muted',
        },
        { view: 'map', label: 'Map', icon: TableProperties },
      ],
    },
    {
      title: 'Documents',
      items: [
        { view: 'runbook', label: 'Build runbook', icon: BookOpenCheck },
        { view: 'recovery', label: 'Recovery routes', icon: LifeBuoy },
        { view: 'letter', label: 'Successor letter', icon: Mail, badge: letterCount || undefined },
      ],
    },
    {
      title: 'More',
      items: [
        { view: 'compare', label: 'Compare plans', icon: GitCompareArrows },
        { view: 'reasoning', label: 'How it reasons', icon: Scale },
        { view: 'file', label: 'Your plan file', icon: FileJson },
      ],
    },
  ]
}

export function Sidebar({
  route,
  report,
  letterCount,
  onNavigate,
}: {
  route: Route
  report: AnalysisReport | null
  letterCount: number
  onNavigate?: () => void
}) {
  return (
    <nav
      aria-label="Sections"
      className="flex min-h-[calc(100dvh-3.05rem)] flex-col gap-5 p-3 lg:min-h-0 lg:flex-1"
    >
      {navigation(report, letterCount).map((group) => (
        <div key={group.title}>
          <p className="eyebrow px-2 pb-1.5">{group.title}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = route.view === item.view
              const Icon = item.icon
              return (
                <li key={item.view}>
                  <a
                    href={href(item.view)}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-[0.8125rem] no-underline transition-colors',
                      active
                        ? 'bg-accent/10 font-medium text-strong shadow-[inset_2px_0_0_0_var(--c-accent)]'
                        : 'text-muted hover:bg-[rgb(var(--tint)/0.05)] hover:text-strong'
                    )}
                  >
                    <Icon
                      className={cn('size-4 flex-none', active ? 'text-accent' : 'text-faint')}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          'mono rounded-full px-1.5 text-[0.6875rem]',
                          item.badgeTone === 'critical'
                            ? 'bg-critical/15 text-critical'
                            : 'bg-[rgb(var(--tint)/0.07)] text-faint'
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto border-t border-line px-2 pt-3">
        <a
          href={href('reasoning')}
          className="flex items-center gap-1.5 text-[0.6875rem] text-faint no-underline transition-colors hover:text-muted"
        >
          <Shapes className="size-3" aria-hidden />
          Read the rules it applies
        </a>
      </div>
    </nav>
  )
}
