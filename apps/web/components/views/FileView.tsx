'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { Database, FileDown, FileUp, Plus, Trash2 } from 'lucide-react'
import {
  parseVendorData,
  today,
  vendorDataAgeDays,
  VENDOR_DATA_VERSION,
  type VendorData,
} from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { MEASURE, Callout, Panel, SectionHeading, ViewHeader } from '@/components/ui/Surface.tsx'
import { Segmented } from '@/components/ui/Field.tsx'
import { Dialog } from '@/components/ui/Dialog.tsx'
import { OpenFileButton } from '@/components/file/OpenFileButton.tsx'
import { useStore } from '@/lib/store.ts'
import {
  readTextFile,
  storedKeysServerSnapshot,
  storedKeysSnapshot,
  subscribeStorage,
} from '@/lib/storage.ts'

/**
 * Where the plan lives, and how to make it not live there.
 *
 * This page exists because the honest answer to "is this safe to use" is not a
 * paragraph of reassurance, it is a list of exactly what is stored, where, and
 * the button that removes it. Somebody on a machine they do not fully trust
 * should be able to read this page and decide.
 */
export function FileView() {
  const plans = useStore((state) => state.plans)
  const activeId = useStore((state) => state.activeId)
  const persistence = useStore((state) => state.preferences.persistence)
  const setPersistence = useStore((state) => state.setPersistence)
  const save = useStore((state) => state.save)
  const startPlan = useStore((state) => state.startPlan)
  const removePlan = useStore((state) => state.removePlan)
  const setActive = useStore((state) => state.setActive)
  const eraseLocal = useStore((state) => state.eraseLocal)
  const vendorData = useStore((state) => state.vendorData)
  const setVendorData = useStore((state) => state.setVendorData)
  const notify = useStore((state) => state.notify)

  const [confirmErase, setConfirmErase] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null)
  const vendorInput = useRef<HTMLInputElement>(null)
  const keys = useSyncExternalStore(subscribeStorage, storedKeysSnapshot, storedKeysServerSnapshot)

  return (
    <div className={MEASURE.read}>
      <ViewHeader
        eyebrow="More"
        title="Your plan file"
        question="Where this lives, what leaves this browser, and how to erase it."
      />

      <div className="space-y-5">
        <Panel className="p-4">
          <SectionHeading
            title="What leaves this browser"
            hint="The short answer is nothing, and here is what that means specifically."
          />
          <ul className="space-y-2 text-[0.875rem] leading-relaxed text-muted">
            <li>
              <strong className="font-medium text-strong">No requests.</strong> The page loads once
              and then never asks for anything. Its Content-Security-Policy sets{' '}
              <code className="mono whitespace-nowrap text-xs text-body">
                connect-src &apos;none&apos;
              </code>
              , so a request would be refused by the browser even if the code tried. The build fails
              if any source in the app gains a way to make one.
            </li>
            <li>
              <strong className="font-medium text-strong">No third parties.</strong> No analytics,
              no telemetry, no error reporting, no update check, no fonts from a content network.
              The two typefaces are files in this app.
            </li>
            <li>
              <strong className="font-medium text-strong">No secrets to leak anyway.</strong> The
              model has no field for a seed word, key, descriptor, address or balance, and every
              text box refuses to store one.
            </li>
            <li>
              <strong className="font-medium text-strong">Open the developer tools</strong> and
              watch the network tab while you use it. That is the check worth doing, and it takes
              ten seconds.
            </li>
          </ul>
        </Panel>

        <Panel className="p-4">
          <SectionHeading
            title="Where this plan is kept"
            hint="Change this if you are on a machine you do not fully trust."
          />
          <Segmented
            value={persistence}
            onChange={setPersistence}
            options={[
              { value: 'local', label: 'In this browser' },
              { value: 'memory', label: 'In memory only' },
            ]}
          />
          <p className="mt-3 text-[0.875rem] leading-relaxed text-muted">
            {persistence === 'local'
              ? 'The plan is written to this browser’s local storage for this site only. It survives closing the tab, it is not synced anywhere, and anybody with this browser profile can read it.'
              : 'Nothing is being written. The plan lasts exactly as long as this tab does, so save it to a file before you close it.'}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={<FileDown className="size-3.5" aria-hidden />}
              onClick={() => void save()}
            >
              Save to a file
            </Button>
            <OpenFileButton icon={<FileUp className="size-3.5" aria-hidden />}>
              Open a file
            </OpenFileButton>
            <Button icon={<Plus className="size-3.5" aria-hidden />} onClick={() => startPlan()}>
              New plan
            </Button>
          </div>
        </Panel>

        <Panel className="p-4">
          <SectionHeading title="Plans open now" />
          <ul className="divide-y divide-line">
            {plans.map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setActive(plan.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block text-sm font-medium text-strong">
                    {plan.name}
                    {plan.id === activeId ? <span className="chip ml-2">open</span> : null}
                  </span>
                  <span className="mono block text-xs text-faint">
                    {plan.kind} · changed {plan.updatedAt} · {plan.keys.length} keys,{' '}
                    {plan.wallets.length} wallets
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${plan.name}`}
                  onClick={() => setConfirmRemove({ id: plan.id, name: plan.name })}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-4">
          <SectionHeading
            title="Optional vendor data"
            hint="Device facts rot, so they are not in the engine."
          />
          {/* Rendered whichever branch is showing, because replacing a file
              you have already loaded is the commonest thing to do with one:
              the whole point of keeping your own is that it goes out of date. */}
          <input
            ref={vendorInput}
            type="file"
            accept="application/json,.json"
            aria-label="Choose a vendor data file to load"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              try {
                const parsed: unknown = JSON.parse(await readTextFile(file))
                const result = parseVendorData(parsed)
                if (!result.ok) {
                  notify({
                    tone: 'error',
                    message: 'That vendor file could not be read',
                    detail: result.problems.join(' · '),
                  })
                  return
                }
                setVendorData(result.value as VendorData)
                notify({
                  tone: 'ok',
                  message: 'Vendor data loaded',
                  detail: `As of ${result.value.asOf}. Nothing in the analysis uses it; it appears as dated notes beside your devices.`,
                })
              } catch {
                notify({ tone: 'error', message: 'That file is not valid JSON' })
              }
            }}
          />
          {vendorData ? (
            <div className="space-y-2 text-[0.875rem] text-muted">
              <p>
                Loaded:{' '}
                <span className="text-strong">
                  {vendorData.vendors.length}{' '}
                  {vendorData.vendors.length === 1 ? 'vendor' : 'vendors'}
                </span>
                , stated as of <span className="mono text-strong">{vendorData.asOf}</span> (
                {vendorDataAgeDays(vendorData, today())} days ago). Source: {vendorData.source}
              </p>
              <p className="text-xs">
                Nothing in the analysis uses this. It appears as notes beside your devices, dated,
                so that a claim from a file you loaded is never mistaken for a conclusion this
                program reached.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  icon={<Database className="size-3.5" aria-hidden />}
                  onClick={() => vendorInput.current?.click()}
                >
                  Replace it
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setVendorData(null)}>
                  Remove it
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-[0.875rem] leading-relaxed text-muted">
              <p>
                None loaded, which is the default and is deliberate. A built-in table of which
                signer has a secure element and which firmware fixed which advisory is correct on
                the day it ships and quietly wrong a year later. Every analysis in this program runs
                identically without it.
              </p>
              <p className="text-xs">
                If you keep your own research, load it here as JSON:{' '}
                <code className="mono text-body">
                  {`{ "version": ${VENDOR_DATA_VERSION}, "asOf": "YYYY-MM-DD", "source": "...", "vendors": [...] }`}
                </code>
              </p>
              <Button
                size="sm"
                icon={<Database className="size-3.5" aria-hidden />}
                onClick={() => vendorInput.current?.click()}
              >
                Load a vendor data file
              </Button>
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <SectionHeading
            title="Everything stored by this site"
            hint="Read from your browser just now, not from a list this app keeps."
          />
          {keys.length === 0 ? (
            <p className="text-sm text-muted">Nothing is stored.</p>
          ) : (
            <ul className="divide-y divide-line text-[0.8125rem]">
              {keys.map((entry) => (
                <li key={entry.key} className="flex items-baseline justify-between gap-3 py-2">
                  <code className="mono min-w-0 truncate text-body">{entry.key}</code>
                  <span className="mono flex-none text-xs text-faint">
                    {(entry.bytes / 1024).toFixed(1)} kB
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Button
              variant="danger"
              icon={<Trash2 className="size-3.5" aria-hidden />}
              onClick={() => setConfirmErase(true)}
            >
              Erase everything
            </Button>
          </div>
        </Panel>

        <Callout>
          This program models structure. It does not know your real threat, cannot verify anything
          you tell it, and is not advice.
        </Callout>
      </div>

      <Dialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.name ?? 'this plan'}?`}
        description="It closes here. If it is not also saved to a file, it is gone."
        footer={
          <>
            <Button onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmRemove) removePlan(confirmRemove.id)
                setConfirmRemove(null)
              }}
            >
              Remove it
            </Button>
          </>
        }
      >
        <p>
          Undo will bring it back while this tab is open. Nothing will after that, because nothing
          here is anywhere else.
        </p>
      </Dialog>

      <Dialog
        open={confirmErase}
        onClose={() => setConfirmErase(false)}
        title="Erase everything stored by this site"
        description="Every plan open now, your preferences, and any vendor data. This cannot be undone from here."
        footer={
          <>
            <Button onClick={() => setConfirmErase(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                eraseLocal()
                setConfirmErase(false)
              }}
            >
              Erase it
            </Button>
          </>
        }
      >
        <p>
          If you have not saved the plan to a file, it is gone. That is the point of the button, and
          it is worth being sure.
        </p>
      </Dialog>
    </div>
  )
}
