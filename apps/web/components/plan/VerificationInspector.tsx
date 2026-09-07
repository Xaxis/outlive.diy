'use client'

import {
  DEFAULT_INTERVAL_DAYS,
  today,
  type EntityType,
  type Plan,
  type Verification,
  type VerificationKind,
} from '@outlive/core'
import { Field, GuardedInput, NumberInput, Select, useFieldLabel } from '@/components/ui/Field.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { Callout } from '@/components/ui/Surface.tsx'
import { useEntityUpdater } from '@/lib/edit.ts'
import { VERIFICATION_KIND } from '@/lib/describe.ts'

const KINDS = Object.keys(VERIFICATION_KIND) as VerificationKind[]

/** Which kind of thing each check is naturally about. */
const SUBJECT_TYPE: Record<VerificationKind, EntityType> = {
  'backup-restore': 'key',
  'config-backup-restore': 'wallet',
  'spend-test': 'wallet',
  'recovery-drill': 'plan',
  'successor-dry-run': 'person',
  'location-access': 'location',
  'device-firmware': 'device',
  'passphrase-recall': 'key',
  'inventory-check': 'plan',
}

/** A date field that names itself from the field it sits in, like the others. */
function DateInput({
  value,
  onChange,
}: {
  value: string | null
  onChange: (next: string | null) => void
}) {
  const labelledBy = useFieldLabel()
  return (
    <input
      type="date"
      aria-labelledby={labelledBy}
      className="input max-w-[11rem]"
      value={value ?? ''}
      max={today()}
      onChange={(event) => onChange(event.target.value || null)}
    />
  )
}

export function VerificationInspector({
  plan,
  verification,
}: {
  plan: Plan
  verification: Verification
}) {
  const update = useEntityUpdater('verification')
  const set = (patch: Partial<Verification>) => update(verification.id, patch)
  const subjectType = SUBJECT_TYPE[verification.kind]

  const subjects =
    subjectType === 'key'
      ? plan.keys
      : subjectType === 'wallet'
        ? plan.wallets
        : subjectType === 'location'
          ? plan.locations
          : subjectType === 'device'
            ? plan.devices
            : subjectType === 'person'
              ? plan.people
              : []

  return (
    <div className="space-y-5">
      <Field label="What is checked">
        <Select
          value={verification.kind}
          onChange={(kind) => {
            const next = (kind ?? 'backup-restore') as VerificationKind
            set({
              kind: next,
              intervalDays: DEFAULT_INTERVAL_DAYS[next],
              subject: {
                type: SUBJECT_TYPE[next],
                id: SUBJECT_TYPE[next] === 'plan' ? plan.id : '',
              },
            })
          }}
          options={KINDS.map((kind) => ({ value: kind, label: VERIFICATION_KIND[kind] }))}
        />
      </Field>

      {subjects.length > 0 ? (
        <Field label="About">
          <Select
            value={verification.subject.id || null}
            placeholder="Choose one"
            onChange={(id) => set({ subject: { type: subjectType, id: id ?? '' } })}
            options={subjects.map((entity) => ({ value: entity.id, label: entity.label }))}
          />
        </Field>
      ) : null}

      <Field
        label="Last done"
        help="Blank means never. That is not a scolding; it is the difference between a fact and a belief, and the analysis treats it that way."
      >
        <div className="flex items-center gap-2">
          <DateInput
            value={verification.lastVerifiedAt}
            onChange={(next) => set({ lastVerifiedAt: next })}
          />
          {verification.lastVerifiedAt === null ? (
            <Button size="sm" onClick={() => set({ lastVerifiedAt: today() })}>
              Done today
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => set({ lastVerifiedAt: null })}>
              Clear
            </Button>
          )}
        </div>
      </Field>

      <Field
        label="How often"
        help="If the interval is unrealistic, change the interval rather than living with it overdue."
      >
        <NumberInput
          value={verification.intervalDays}
          min={1}
          max={3650}
          suffix="days"
          onChange={(days) => set({ intervalDays: days ?? 365 })}
        />
      </Field>

      {verification.subject.id === '' && subjects.length > 0 ? (
        <Callout tone="warn">
          This check is not attached to anything yet, so it counts for nothing.
        </Callout>
      ) : null}

      <Field label="Notes">
        <GuardedInput
          multiline
          rows={3}
          value={verification.notes}
          onCommit={(value) => set({ notes: value })}
        />
      </Field>
    </div>
  )
}
