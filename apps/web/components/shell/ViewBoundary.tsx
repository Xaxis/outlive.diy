'use client'

import { Component, type ReactNode } from 'react'
import { FileDown, LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/Button.tsx'
import { useStore } from '@/lib/store.ts'
import { navigateTo } from '@/lib/router.ts'

/**
 * When a view breaks, the plan does not go with it.
 *
 * A plan file can hold shapes this program has never been asked about, and a
 * view that throws on one used to take the whole page to white, which reads
 * as the plan being gone. It is not: it is in the store and in this browser.
 * So the broken view is replaced by a sentence saying so and the two things
 * worth doing next: keep a copy, and go somewhere that works. The message
 * names the error and never the plan, which is the reader's and not a thing
 * to print on a screen that might be photographed for a bug report.
 */
export class ViewBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return <Broken error={this.state.error} />
  }
}

function Broken({ error }: { error: Error }) {
  const save = useStore((state) => state.save)
  return (
    <div role="alert" className="card max-w-2xl p-6">
      <LifeBuoy className="size-5 text-medium" aria-hidden />
      <h1 className="mt-3 text-base font-semibold text-strong">This view could not be drawn</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Your plan is untouched: it is still in this browser, and every other view still works. Keep
        a copy of the file before anything else, then carry on from the overview.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon={<FileDown className="size-4" aria-hidden />}
          onClick={() => void save()}
        >
          Save the plan file
        </Button>
        <Button onClick={() => navigateTo('overview')}>Go to the overview</Button>
      </div>
      <p className="mono mt-4 break-words text-[0.6875rem] text-faint">
        {error.name}: {error.message}
      </p>
    </div>
  )
}
