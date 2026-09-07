'use client'

import type { Device, DeviceKind, Plan, SupplyChain } from '@outlive/core'
import { Field, GuardedInput, Select, Toggle } from '@/components/ui/Field.tsx'
import { Callout } from '@/components/ui/Surface.tsx'
import { useEntityUpdater } from '@/lib/edit.ts'
import { DEVICE_KIND, SUPPLY_CHAIN } from '@/lib/describe.ts'

const KINDS = Object.keys(DEVICE_KIND) as DeviceKind[]
const ROUTES = Object.keys(SUPPLY_CHAIN) as SupplyChain[]

export function DeviceInspector({ plan, device }: { plan: Plan; device: Device }) {
  const update = useEntityUpdater('device')
  const set = (patch: Partial<Device>) => update(device.id, patch)

  return (
    <div className="space-y-5">
      <Field label="Label">
        <GuardedInput value={device.label} onCommit={(value) => set({ label: value })} />
      </Field>

      <Field label="What it is">
        <Select
          value={device.kind}
          onChange={(kind) => set({ kind: (kind ?? 'other') as DeviceKind })}
          options={KINDS.map((kind) => ({ value: kind, label: DEVICE_KIND[kind] }))}
        />
      </Field>

      <Field
        label="Maker"
        help="Free text, and it matters structurally even if you leave the model blank. Two keys behind one maker are one decision, one firmware lineage and one bad day."
      >
        <GuardedInput
          value={device.vendor ?? ''}
          placeholder="e.g. Vendor One"
          onCommit={(value) => set({ vendor: value.trim() === '' ? null : value })}
        />
      </Field>

      <Field label="Model" help="Optional. Nothing in the analysis needs it.">
        <GuardedInput
          value={device.model ?? ''}
          onCommit={(value) => set({ model: value.trim() === '' ? null : value })}
        />
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

      <Field label="How you got it">
        <Select
          value={device.supplyChain}
          onChange={(route) => set({ supplyChain: (route ?? 'unknown') as SupplyChain })}
          options={ROUTES.map((route) => ({ value: route, label: SUPPLY_CHAIN[route] }))}
        />
      </Field>

      <div className="space-y-3">
        <Toggle
          checked={device.airGapped}
          label="Air-gapped"
          help="Never connected to anything. Signs by camera, card or cable-free transfer only."
          onChange={(value) => set({ airGapped: value })}
        />
        <Toggle
          checked={device.storesWalletConfig}
          label="It stores the multisig wallet configuration"
          help="Most signers do not. Assuming otherwise is how people find out at recovery time that a threshold of seeds is not enough."
          onChange={(value) => set({ storesWalletConfig: value })}
        />
      </div>

      <Field
        label="PIN"
        help="A PIN is what makes holding the device insufficient. Where it lives is therefore part of the plan."
      >
        <Select
          value={device.pin.storage}
          onChange={(storage) =>
            set({
              pin: {
                ...device.pin,
                storage: (storage ?? 'memorized') as Device['pin']['storage'],
                locationId: storage === 'written' ? device.pin.locationId : null,
              },
            })
          }
          options={[
            { value: 'memorized', label: 'Memorised' },
            { value: 'written', label: 'Written down somewhere' },
            { value: 'none', label: 'No PIN' },
          ]}
        />
      </Field>

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
        <Callout tone="warn" title="Without a PIN, possession is enough">
          Anyone who picks this device up can sign with it. That is fine for a signer holding a hot
          key and a small balance, and it is not fine for anything else.
        </Callout>
      ) : null}

      <Field label="Notes">
        <GuardedInput
          multiline
          rows={3}
          value={device.notes}
          onCommit={(value) => set({ notes: value })}
        />
      </Field>
    </div>
  )
}
