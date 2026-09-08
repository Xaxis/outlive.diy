'use client'

import { Plus } from 'lucide-react'
import {
  createBackup,
  type Backup,
  type BackupMedium,
  type Key,
  type PassphraseStorage,
  type Plan,
} from '@outlive/core'
import {
  ChipSet,
  Field,
  GuardedInput,
  NumberInput,
  Select,
  Toggle,
} from '@/components/ui/Field.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ItemList } from '@/components/ui/ItemList.tsx'
import { Callout, SectionHeading } from '@/components/ui/Surface.tsx'
import { useEntityUpdater, usePlanEdit } from '@/lib/edit.ts'
import { BACKUP_MEDIUM, BACKUP_MEDIUM_NOTE } from '@/lib/describe.ts'

const MEDIA = Object.keys(BACKUP_MEDIUM) as BackupMedium[]

function BackupEditor({
  plan,
  keyId,
  backup,
  position,
}: {
  plan: Plan
  keyId: string
  backup: Backup
  position: number
}) {
  const edit = usePlanEdit()
  const patch = (recipe: (backup: Backup) => void) =>
    edit((draft) => {
      const key = draft.keys.find((entry) => entry.id === keyId)
      const target = key?.backups[position]
      if (target) recipe(target)
    })

  return (
    <>
      <Field label="Name">
        <GuardedInput
          ariaLabel="Backup name"
          value={backup.label}
          onCommit={(value) => patch((entry) => void (entry.label = value))}
        />
      </Field>

      <Field label="Medium" help={BACKUP_MEDIUM_NOTE[backup.medium]}>
        <Select
          value={backup.medium}
          onChange={(medium) =>
            patch((entry) => {
              entry.medium = (medium ?? 'steel') as BackupMedium
              if (entry.medium === 'memorized') entry.locationId = null
            })
          }
          options={MEDIA.map((medium) => ({ value: medium, label: BACKUP_MEDIUM[medium] }))}
        />
      </Field>

      {backup.medium !== 'memorized' ? (
        <Field label="Where it is">
          <Select
            value={backup.locationId}
            placeholder="Not recorded"
            onChange={(locationId) => patch((entry) => void (entry.locationId = locationId))}
            options={plan.locations.map((location) => ({
              value: location.id,
              label: location.label,
            }))}
          />
        </Field>
      ) : null}

      <Toggle
        checked={backup.split !== null}
        label="This is one share of a split"
        help="Shamir or SLIP-39. Several shares of the same secret, each in its own place, with a threshold to rebuild it."
        onChange={(value) =>
          patch((entry) => {
            entry.split = value ? { groupId: `split-${keyId}`, threshold: 2 } : null
          })
        }
      />

      {backup.split ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Split group" help="Shares sharing a group rebuild the same secret.">
            <GuardedInput
              value={backup.split.groupId}
              onCommit={(value) =>
                patch((entry) => {
                  if (entry.split) entry.split.groupId = value
                })
              }
            />
          </Field>
          <Field label="Shares needed">
            <NumberInput
              value={backup.split.threshold}
              min={1}
              max={32}
              onChange={(threshold) =>
                patch((entry) => {
                  if (entry.split) entry.split.threshold = threshold ?? 2
                })
              }
            />
          </Field>
        </div>
      ) : null}

      <Toggle
        checked={backup.tamperEvident}
        label="Sealed, tamper-evident"
        onChange={(value) => patch((entry) => void (entry.tamperEvident = value))}
      />
    </>
  )
}

/** What a backup says when its row is shut. Facts, in the plan's own words. */
function describeBackup(plan: Plan, backup: Backup): string {
  const medium = BACKUP_MEDIUM[backup.medium].toLowerCase()
  const where =
    backup.medium === 'memorized'
      ? 'in a head'
      : backup.locationId
        ? (plan.locations.find((entry) => entry.id === backup.locationId)?.label ?? 'somewhere')
        : 'no place recorded'
  const share = backup.split ? `share, ${backup.split.threshold} needed` : null
  return [medium, share, where].filter(Boolean).join(' · ')
}

export function KeyInspector({ plan, entity }: { plan: Plan; entity: Key }) {
  const update = useEntityUpdater('key')
  const edit = usePlanEdit()
  const set = (patch: Partial<Key>) => update(entity.id, patch)
  const device = plan.devices.find((candidate) => candidate.id === entity.deviceId)

  return (
    <div className="space-y-5">
      <Field label="Label">
        <GuardedInput value={entity.label} onCommit={(value) => set({ label: value })} />
      </Field>

      <Field
        label="Device it lives on"
        help="Leave unset for a key that exists only as a written backup, which is a legitimate design and a different set of risks."
      >
        <Select
          value={entity.deviceId}
          placeholder="No device"
          onChange={(deviceId) => set({ deviceId })}
          options={plan.devices.map((candidate) => ({
            value: candidate.id,
            label: candidate.label,
          }))}
        />
      </Field>

      {entity.deviceId ? (
        <Field label="Where that device is kept">
          <Select
            value={entity.deviceLocationId}
            placeholder="Not recorded"
            onChange={(locationId) => set({ deviceLocationId: locationId })}
            options={plan.locations.map((location) => ({
              value: location.id,
              label: location.label,
            }))}
          />
        </Field>
      ) : null}

      {plan.people.length > 0 ? (
        <Field
          label="Held by someone else"
          help={
            entity.heldBy === null
              ? 'A key somebody else holds, in collaborative custody. Leave this alone if you hold it.'
              : 'Independent only if you never saw it, and dependent on somebody answering the phone.'
          }
        >
          <Select
            value={entity.heldBy}
            placeholder="I hold it"
            onChange={(personId) => set({ heldBy: personId })}
            options={plan.people.map((person) => ({ value: person.id, label: person.label }))}
          />
        </Field>
      ) : null}

      <div>
        <SectionHeading
          title="Backups"
          hint="What this key can be rebuilt from when the device is gone."
          actions={
            <Button
              size="sm"
              icon={<Plus className="size-3.5" aria-hidden />}
              onClick={() =>
                edit((draft) => {
                  const key = draft.keys.find((candidate) => candidate.id === entity.id)
                  key?.backups.push(
                    createBackup({
                      label: `Backup ${(key.backups.length ?? 0) + 1}`,
                      medium: 'steel',
                    })
                  )
                })
              }
            >
              Add backup
            </Button>
          }
        />
        {entity.backups.length === 0 ? (
          <Callout tone={device ? 'warn' : 'danger'}>
            {device
              ? `${entity.label} exists only on ${device.label}. A dead battery, a failed firmware update, a drop or a customs officer removes it permanently.`
              : `${entity.label} has neither a device nor a backup. Nothing in this plan can produce that signature.`}
          </Callout>
        ) : (
          <ItemList
            items={entity.backups.map((backup, position) => ({
              id: backup.id,
              title: backup.label,
              summary: describeBackup(plan, backup),
              removeLabel: `Remove ${backup.label}`,
              onRemove: () =>
                edit((draft) => {
                  const key = draft.keys.find((candidate) => candidate.id === entity.id)
                  key?.backups.splice(position, 1)
                }),
              body: (
                <BackupEditor plan={plan} keyId={entity.id} backup={backup} position={position} />
              ),
            }))}
          />
        )}
      </div>

      <div>
        <SectionHeading
          title="Passphrase"
          hint="A second secret with its own failure modes, not part of the seed."
        />
        <Toggle
          checked={entity.passphrase.enabled}
          label="This key uses a passphrase"
          onChange={(value) => set({ passphrase: { ...entity.passphrase, enabled: value } })}
        />

        {entity.passphrase.enabled ? (
          <div className="mt-3 space-y-4">
            <Field label="Where it lives">
              <Select
                value={entity.passphrase.storage}
                onChange={(storage) =>
                  set({
                    passphrase: {
                      ...entity.passphrase,
                      storage: (storage ?? 'memorized') as PassphraseStorage,
                      locationIds: storage === 'memorized' ? [] : entity.passphrase.locationIds,
                    },
                  })
                }
                options={[
                  { value: 'memorized', label: 'Only in my memory' },
                  { value: 'written', label: 'Written down' },
                  { value: 'split', label: 'Split across places' },
                ]}
              />
            </Field>

            {entity.passphrase.storage === 'memorized' ? (
              <Callout tone="warn">
                A memory is a single copy in an organ with no redundancy and a known failure rate.
                Every backup of {entity.label} is inert without it, and it does not survive you.
              </Callout>
            ) : (
              <>
                <Field
                  label="Which places"
                  help="Anywhere that also holds a seed backup of this key makes the passphrase decoration."
                >
                  <ChipSet
                    values={entity.passphrase.locationIds}
                    onChange={(locationIds) =>
                      set({ passphrase: { ...entity.passphrase, locationIds } })
                    }
                    options={plan.locations.map((location) => ({
                      value: location.id,
                      label: location.label,
                    }))}
                  />
                </Field>
                {entity.passphrase.storage === 'split' ? (
                  <Field label="Shares needed">
                    <NumberInput
                      value={entity.passphrase.splitThreshold ?? 2}
                      min={1}
                      max={32}
                      onChange={(threshold) =>
                        set({ passphrase: { ...entity.passphrase, splitThreshold: threshold } })
                      }
                    />
                  </Field>
                ) : null}
              </>
            )}

            {plan.people.length > 0 ? (
              <Field
                label="Who else knows it"
                help="Anyone here can use this key with you gone, and without you, today."
              >
                <ChipSet
                  values={entity.passphrase.knownBy}
                  onChange={(knownBy) => set({ passphrase: { ...entity.passphrase, knownBy } })}
                  options={plan.people.map((person) => ({ value: person.id, label: person.label }))}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </div>

      <Field label="Notes">
        <GuardedInput
          multiline
          rows={3}
          value={entity.notes}
          onCommit={(value) => set({ notes: value })}
        />
      </Field>
    </div>
  )
}
