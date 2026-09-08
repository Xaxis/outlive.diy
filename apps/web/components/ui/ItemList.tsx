'use client'

import { useState, type ReactNode } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * A list of repeated things inside an inspector: the backups of a key, the
 * ways to spend a wallet, the copies of its configuration, the people who can
 * open a door.
 *
 * Every one of these used to be a stack of fully expanded forms, in four
 * separate implementations that had drifted apart. Three backups on a key meant
 * fifteen fields down the panel and no way to see, at a glance, what the key
 * actually had. That is the wrong shape: the list is the thing you read, and
 * one item at a time is the thing you edit.
 *
 * So each row collapses to its own summary and expands to its fields. The
 * summary is the point of the pattern rather than a decoration on it. "Steel,
 * Site A" answers the question the panel is there to answer; a collapsed row
 * saying only "Backup 2" would have made the list shorter and no more useful.
 *
 * A row that has just been added opens itself, because you added it in order to
 * fill it in. Everything already there stays shut. The list works out which is
 * which from the ids it has seen, so no caller has to track it.
 *
 * This is for the repeated parts *inside* one entity. The list of keys or
 * places down the side of the workbench is a different thing, and stays one.
 */

export interface Item {
  /** Stable across renders. A new id is what makes a row open itself. */
  id: string
  /** The row's name, shown in the header. */
  title: string
  /**
   * What this row says when it is shut, in the plan's own terms. Facts only:
   * the medium and the place, the threshold and the timelock. Judgement about
   * them belongs in the findings, which have room to explain themselves.
   */
  summary: string
  body: ReactNode
  onRemove?: () => void
  /** Named for a screen reader, because every row's button says the same thing. */
  removeLabel?: string
}

export function ItemList({ items, className }: { items: Item[]; className?: string }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  // Ids this list has already rendered. Anything not in here is new, and a
  // thing you just added is a thing you want open.
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(items.map((i) => i.id)))

  const ids = items.map((item) => item.id)
  const fresh = ids.filter((id) => !seen.has(id))
  if (fresh.length > 0) {
    setSeen(new Set(ids))
    setOpen(new Set([...open, ...fresh]))
  }

  const toggle = (id: string) => {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {items.map((item) => {
        const expanded = open.has(item.id)
        return (
          <li key={item.id} className="card overflow-hidden">
            <div className="flex items-center gap-1 pr-1.5">
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-2.5 pr-1 text-left"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 flex-none text-faint transition-transform',
                    expanded && 'rotate-90'
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-strong">
                    {item.title}
                  </span>
                  <span className="mono block truncate text-[0.6875rem] text-faint">
                    {item.summary}
                  </span>
                </span>
              </button>
              {item.onRemove ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={item.removeLabel ?? `Remove ${item.title}`}
                  onClick={item.onRemove}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>

            {/* Kept mounted and hidden rather than unmounted, so that closing a
                row never throws away something half typed into it. */}
            <div hidden={!expanded} className="space-y-3 border-t border-line px-2.5 pb-3 pt-3">
              {item.body}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
