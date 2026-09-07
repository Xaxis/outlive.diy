'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button.tsx'
import { Dialog } from '@/components/ui/Dialog.tsx'
import { readTextFile } from '@/lib/storage.ts'
import { useStore } from '@/lib/store.ts'

/**
 * Opening a plan is a file picker and nothing else. There is no account, no
 * sync and no "recent files on our servers", because there are no servers.
 *
 * Opening replaces what is open, which is what "open" means everywhere else,
 * and is also how somebody loses an afternoon. If there are unsaved changes,
 * the file is held until that has been said out loud.
 */
export function OpenFileButton({
  children,
  icon,
  variant = 'default',
}: {
  children: ReactNode
  icon?: ReactNode
  variant?: 'primary' | 'default' | 'ghost'
}) {
  const input = useRef<HTMLInputElement>(null)
  const importFile = useStore((state) => state.importFile)
  const [pending, setPending] = useState<string | null>(null)

  const offer = (text: string) => {
    const { dirty, plans } = useStore.getState()
    if (dirty && plans.length > 0) {
      setPending(text)
      return
    }
    importFile(text)
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Choose a plan file to open"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          try {
            offer(await readTextFile(file))
          } catch {
            useStore.getState().notify({
              tone: 'error',
              message: 'That file could not be read',
              detail: 'The browser refused to open it. Check that it is still where it was.',
            })
          }
        }}
      />
      <Button variant={variant} icon={icon} onClick={() => input.current?.click()}>
        {children}
      </Button>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Close what is open first?"
        description="Opening a file replaces every plan currently open, and this one has changes you have not saved."
        footer={
          <>
            <Button onClick={() => setPending(null)}>Keep what I have</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pending !== null) importFile(pending)
                setPending(null)
              }}
            >
              Open it anyway
            </Button>
          </>
        }
      >
        <p>
          Save the current plan to a file first if you want to keep it. Nothing here is recoverable
          afterwards, because nothing here is anywhere else.
        </p>
      </Dialog>
    </>
  )
}
