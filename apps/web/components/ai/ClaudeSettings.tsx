'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button.tsx'
import { Panel, SectionHeading } from '@/components/ui/Surface.tsx'
import { KeyForm } from '@/components/ai/KeyForm.tsx'
import { forgetClaudeKey, maskKey, useClaudeKey } from '@/lib/ai/key.ts'
import { MODEL } from '@/lib/ai/client.ts'

/** Where the key is seen, and removed. Beside the rest of what is stored. */
export function ClaudeSettings() {
  const { key, remembered } = useClaudeKey()
  return (
    <Panel className="p-4">
      <SectionHeading
        title="Claude"
        hint="Off until you enter a key. With one, questions you ask go from this browser to Anthropic and nowhere else, carrying the plan's structure and findings with every note removed and checked by the guard first."
      />
      {key ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Sparkles className="size-4 text-accent" aria-hidden />
          <span className="text-body">
            Using key <span className="mono text-strong">{maskKey(key)}</span> with {MODEL},{' '}
            {remembered ? 'remembered in this browser.' : 'for this tab only.'}
          </span>
          <Button size="sm" variant="danger" onClick={forgetClaudeKey}>
            Forget the key
          </Button>
        </div>
      ) : (
        <KeyForm />
      )}
    </Panel>
  )
}
