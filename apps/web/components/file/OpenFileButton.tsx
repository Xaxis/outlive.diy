'use client'

import { useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button.tsx'
import { readTextFile } from '@/lib/storage.ts'
import { useStore } from '@/lib/store.ts'

/**
 * Opening a plan is a file picker and nothing else. There is no account, no
 * sync and no "recent files on our servers", because there are no servers.
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
            importFile(await readTextFile(file))
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
    </>
  )
}
