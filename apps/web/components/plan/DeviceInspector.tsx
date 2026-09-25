'use client'

import { useState } from 'react'

import {
  Cloud,
  Cpu,
  KeyRound,
  Laptop,
  MapPin,
  ShieldCheck,
  Smartphone,
  WifiOff,
  Wrench,
} from 'lucide-react'
import {
  lookupVendor,
  type Device,
  type DeviceKind,
  type Plan,
  type SupplyChain,
} from '@outlive/core'
import { Field, GuardedInput, Segmented, Select } from '@/components/ui/Field.tsx'
import { Disclosure } from '@/components/ui/Disclosure.tsx'
import { Callout, Info } from '@/components/ui/Surface.tsx'
import { useEntityUpdater } from '@/lib/edit.ts'
import { useStore } from '@/lib/store.ts'
import { href } from '@/lib/router.ts'
import { DEVICE_KIND, SUPPLY_CHAIN } from '@/lib/describe.ts'
import { DEVICE_CATALOG, makerNamed, modelNamed } from '@/lib/devices.ts'
import { cn } from '@/lib/cn.ts'

/**
 * One signing device, edited as the object it is.
 *
 * This was ten full-width fields in a column, in the order the type declares
 * them, which put the label first and the thing that decides the analysis,
 * the maker, fourth. Now the device reads like a device: what it is, picked
 * from a list or typed, then the handful of yes-or-no facts about how it is
 * used, each one a click. The label and the rarely-known architecture sit in
 * a fold, because most people never need to touch them.
 */

export const DEVICE_ICON: Record<DeviceKind, typeof Cpu> = {
  'hardware-signer': Cpu,
  'air-gapped-signer': WifiOff,
  'mobile-wallet': Smartphone,
  'desktop-wallet': Laptop,
  'paper-only': KeyRound,
  'service-cosigner': Cloud,
  other: Wrench,
}

/** The kinds worth a tile, in the order people own them. */
const KIND_TILES: DeviceKind[] = [
  'hardware-signer',
  'air-gapped-signer',
  'mobile-wallet',
  'desktop-wallet',
  'service-cosigner',
  'other',
]

export function DeviceInspector({ plan, device }: { plan: Plan; device: Device }) {
  const update = useEntityUpdater('device')
  const vendorData = useStore((state) => state.vendorData)
  const set = (patch: Partial<Device>) => update(device.id, patch)
  const vendorEntry = vendorData ? lookupVendor(vendorData, device.vendor) : null
  const keys = plan.keys.filter((key) => key.deviceId === device.id)
  const place = (id: string | null) => plan.locations.find((entry) => entry.id === id)?.label

  return (
    <div className="space-y-5">
      <MakerAndModel device={device} set={set} />

      <div>
        <p className="label mb-1.5">What it is</p>
        <div
          role="radiogroup"
          aria-label="What it is"
          className="grid grid-cols-3 gap-1.5 sm:grid-cols-6"
        >
          {KIND_TILES.map((kind) => {
            const Icon = DEVICE_ICON[kind]
            const on = device.kind === kind
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() =>
                  set({ kind, airGapped: kind === 'air-gapped-signer' ? true : device.airGapped })
                }
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-[var(--radius-control)] border px-1 py-2.5 text-center text-[0.6875rem] leading-tight transition-colors',
                  on
                    ? 'border-accent bg-accent/10 text-strong'
                    : 'border-line text-muted hover:border-line-strong hover:text-strong'
                )}
              >
                <Icon className={cn('size-4', on ? 'text-accent' : 'text-faint')} aria-hidden />
                {DEVICE_KIND[kind]}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="label mb-1.5">How it is used</p>
        <div className="flex flex-wrap gap-1.5">
          <Pill
            on={device.airGapped}
            onClick={() => set({ airGapped: !device.airGapped })}
            icon={<WifiOff className="size-3.5" aria-hidden />}
            title="Never connected to anything. Signs by camera, card or cable-free transfer only."
          >
            Air-gapped
          </Pill>
          <Pill
            on={device.storesWalletConfig}
            onClick={() => set({ storesWalletConfig: !device.storesWalletConfig })}
            icon={<ShieldCheck className="size-3.5" aria-hidden />}
            title="Most signers do not store the multisig wallet configuration. Assuming otherwise is how people find out at recovery time that a threshold of seeds is not enough."
          >
            Stores the multisig descriptor
          </Pill>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="PIN">
          <Segmented
            value={device.pin.storage}
            onChange={(storage) =>
              set({
                pin: {
                  ...device.pin,
                  storage,
                  locationId: storage === 'written' ? device.pin.locationId : null,
                },
              })
            }
            options={[
              { value: 'memorized', label: 'Memorised' },
              { value: 'written', label: 'Written' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Field>
        <Field label="Bought">
          <Segmented
            value={device.supplyChain}
            onChange={(route) => set({ supplyChain: route as SupplyChain })}
            options={(Object.keys(SUPPLY_CHAIN) as SupplyChain[]).map((route) => ({
              value: route,
              label:
                route === 'direct-from-vendor'
                  ? 'Direct'
                  : route === 'reseller'
                    ? 'Reseller'
                    : route === 'second-hand'
                      ? 'Used'
                      : '?',
              hint: SUPPLY_CHAIN[route],
            }))}
          />
        </Field>
      </div>

      {device.pin.storage === 'written' ? (
        <Field label="Where the PIN is written">
          <Select
            value={device.pin.locationId}
            placeholder="Not recorded"
            onChange={(locationId) => set({ pin: { ...device.pin, locationId } })}
            options={plan.locations.map((location) => ({
              value: location.id,
              label: location.label,
            }))}
          />
        </Field>
      ) : null}

      {device.pin.storage === 'none' ? (
        <Callout tone="warn" title="Without a PIN, holding it is enough to sign">
          Fine for a phone with pocket money on it; not for anything else.
        </Callout>
      ) : null}

      <div>
        <p className="label mb-1.5">
          What it holds
          <Info>Keys are put on a device from the keys step, or from the grid above.</Info>
        </p>
        {keys.length === 0 ? (
          <p className="text-xs text-faint">No key uses this device yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {keys.map((key) => (
              <li key={key.id} className="chip gap-1.5">
                <KeyRound className="size-3 text-accent" aria-hidden />
                {key.label}
                {key.deviceLocationId ? (
                  <span className="flex items-center gap-0.5 text-faint">
                    <MapPin className="size-3" aria-hidden />
                    {place(key.deviceLocationId)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {vendorEntry && vendorData ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-sunken p-3">
          <p className="eyebrow mb-1.5">From your vendor file, as of {vendorData.asOf}</p>
          <ul className="space-y-1 text-xs leading-relaxed text-muted">
            {vendorEntry.architecture ? <li>Architecture: {vendorEntry.architecture}</li> : null}
            {vendorEntry.secureElement !== undefined ? (
              <li>{vendorEntry.secureElement ? 'Has a secure element' : 'No secure element'}</li>
            ) : null}
            {vendorEntry.airGapCapable !== undefined ? (
              <li>{vendorEntry.airGapCapable ? 'Can run air-gapped' : 'Cannot run air-gapped'}</li>
            ) : null}
            {vendorEntry.storesWalletConfig !== undefined ? (
              <li>
                {vendorEntry.storesWalletConfig
                  ? 'Stores the multisig wallet configuration'
                  : 'Does not store the multisig wallet configuration'}
              </li>
            ) : null}
            {(vendorEntry.advisories ?? []).map((advisory) => (
              <li key={advisory.id}>
                {advisory.id} ({advisory.date}): {advisory.summary}
              </li>
            ))}
            {vendorEntry.notes ? <li>{vendorEntry.notes}</li> : null}
          </ul>
          <p className="mt-2 border-t border-line pt-2 text-[0.6875rem] leading-relaxed text-faint">
            Claims from a file you loaded, not conclusions this program reached.{' '}
            <a href={href('file')} className="link">
              Manage the file
            </a>
          </p>
        </div>
      ) : null}

      <Disclosure size="aside" title="Name, architecture, notes">
        <div className="mt-3 space-y-4">
          <Field label="Name in this plan">
            <GuardedInput value={device.label} onCommit={(value) => set({ label: value })} />
          </Field>
          <Field
            label="Architecture"
            help="Shared silicon or a shared firmware lineage crosses brand boundaries, so two different logos can still be one failure. Leave blank if you do not know."
          >
            <GuardedInput
              value={device.architecture ?? ''}
              onCommit={(value) => set({ architecture: value.trim() === '' ? null : value })}
            />
          </Field>
          <Field label="Notes">
            <GuardedInput
              multiline
              rows={3}
              value={device.notes}
              onCommit={(value) => set({ notes: value })}
            />
          </Field>
        </div>
      </Disclosure>
    </div>
  )
}

function Pill({
  on,
  onClick,
  icon,
  title,
  children,
}: {
  on: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
        on
          ? 'border-accent bg-accent/10 text-strong'
          : 'border-line text-muted hover:border-line-strong hover:text-strong'
      )}
    >
      <span className={on ? 'text-accent' : 'text-faint'}>{icon}</span>
      {children}
    </button>
  )
}

const OTHER = '__other'

/**
 * Maker and model: a list of the known ones, and "Other" for everything else.
 *
 * A dropdown alone cannot hold the device nobody put on the list, and a text
 * box alone gets "Trezor" and "trezor " as two makers, which the analysis then
 * counts as two. So each is a dropdown with "Other…" at the end, and choosing
 * it opens a field for the name. A name already typed that is not on the list
 * shows as Other with its field filled. Typed names go through the guard like
 * every other field.
 */
function MakerAndModel({ device, set }: { device: Device; set: (patch: Partial<Device>) => void }) {
  // Which fields the reader has switched to Other, for this device only.
  const [other, setOther] = useState({ id: device.id, maker: false, model: false })
  if (other.id !== device.id) setOther({ id: device.id, maker: false, model: false })

  const maker = makerNamed(device.vendor)
  const customMaker = other.maker || (device.vendor !== null && maker === null)
  const models = maker?.models ?? []
  const listedModel = modelNamed(device.vendor, device.model)
  const customModel = other.model || customMaker || (device.model !== null && listedModel === null)

  const pickMaker = (value: string) => {
    if (value === OTHER) {
      setOther({ ...other, maker: true, model: true })
      set({ vendor: null, model: null })
      return
    }
    setOther({ ...other, maker: false, model: false })
    if (value === '') {
      set({ vendor: null, model: null })
      return
    }
    const picked = makerNamed(value)
    // A maker with one model means the model too.
    const only = picked && picked.models.length === 1 ? picked.models[0] : null
    set({
      vendor: value,
      model: only?.name ?? null,
      ...(only ? { kind: only.kind, airGapped: only.airGapOnly ?? device.airGapped } : {}),
    })
  }

  const pickModel = (value: string) => {
    if (value === OTHER) {
      setOther({ ...other, model: true })
      set({ model: null })
      return
    }
    setOther({ ...other, model: false })
    const model = models.find((entry) => entry.name === value)
    set({
      model: value === '' ? null : value,
      ...(model ? { kind: model.kind, airGapped: model.airGapOnly ?? device.airGapped } : {}),
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Maker">
        <select
          aria-label="Maker"
          className="select"
          value={customMaker ? OTHER : (maker?.name ?? '')}
          onChange={(event) => pickMaker(event.target.value)}
        >
          <option value="">Choose a maker</option>
          {DEVICE_CATALOG.map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.name}
            </option>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
        {customMaker ? (
          <GuardedInput
            ariaLabel="Maker name"
            placeholder="Type the maker"
            value={device.vendor ?? ''}
            onCommit={(value) => set({ vendor: value.trim() === '' ? null : value })}
          />
        ) : null}
      </Field>
      <Field label="Model">
        {customMaker ? null : (
          <select
            aria-label="Model"
            className="select"
            disabled={!maker}
            value={customModel ? OTHER : (listedModel?.name ?? '')}
            onChange={(event) => pickModel(event.target.value)}
          >
            <option value="">{maker ? 'Choose a model' : 'Choose a maker first'}</option>
            {models.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
          </select>
        )}
        {customModel ? (
          <GuardedInput
            ariaLabel="Model name"
            placeholder="Type the model"
            value={device.model ?? ''}
            onCommit={(value) => set({ model: value.trim() === '' ? null : value })}
          />
        ) : null}
      </Field>
    </div>
  )
}
