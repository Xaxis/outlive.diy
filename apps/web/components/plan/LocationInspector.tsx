'use client'

import { Plus } from 'lucide-react'
import type { AccessCondition, Location, LocationAccess, LocationKind, Plan } from '@outlive/core'
import {
  Field,
  GuardedInput,
  NumberInput,
  PresetNumber,
  Select,
  Toggle,
} from '@/components/ui/Field.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ItemList } from '@/components/ui/ItemList.tsx'
import { SectionHeading } from '@/components/ui/Surface.tsx'
import { useEntityUpdater, usePlanEdit } from '@/lib/edit.ts'
import { ACCESS_CONDITION, LOCATION_KIND } from '@/lib/describe.ts'

const KINDS = Object.keys(LOCATION_KIND) as LocationKind[]
const CONDITIONS = Object.keys(ACCESS_CONDITION) as AccessCondition[]

/** What a door-access row says when it is shut. */
function describeAccess(access: LocationAccess): string {
  if (access.condition === 'always') return 'any time, without you'
  if (access.condition === 'with-user') return 'only with you there'
  return access.delayDays > 0
    ? `after your death, ${access.delayDays} days later`
    : 'after your death'
}

/**
 * How long an estate takes to release something, in the units estates are
 * measured in. Nobody knows their own probate to the day, and a number box
 * invites a guess that then gets treated as a fact by the timing analysis.
 */
const PROBATE = [
  { value: 0, label: 'No delay' },
  { value: 30, label: 'About a month' },
  { value: 60, label: 'About two months' },
  { value: 180, label: 'About six months' },
  { value: 365, label: 'About a year' },
]

export function LocationInspector({ plan, location }: { plan: Plan; location: Location }) {
  const update = useEntityUpdater('location')
  const edit = usePlanEdit()
  const set = (patch: Partial<Location>) => update(location.id, patch)

  const groups = [...new Set(plan.locations.map((entry) => entry.disasterGroup).filter(Boolean))]

  return (
    <div className="space-y-5">
      <Field label="Label" help="A role, not a street. Site A, Site B, the bank.">
        <GuardedInput value={location.label} onCommit={(value) => set({ label: value })} />
      </Field>

      <Field label="What kind of place">
        <Select
          value={location.kind}
          onChange={(kind) => set({ kind: (kind ?? 'other') as LocationKind })}
          options={KINDS.map((kind) => ({ value: kind, label: LOCATION_KIND[kind] }))}
        />
      </Field>

      <Field
        label="Travel time, one way"
        help="Distance is one of only three things that slow an attacker down. Leave it blank if you genuinely do not know; the coercion analysis will then assume it is close."
      >
        <NumberInput
          value={location.travelMinutes}
          nullable
          max={100000}
          suffix="minutes"
          onChange={(minutes) => set({ travelMinutes: minutes })}
        />
      </Field>

      <Field
        label="Disaster group"
        help="What this place would fail together with: a building, a city, a flood plain, a jurisdiction. Two places sharing a group are one place as far as fire and flood are concerned."
      >
        <GuardedInput
          value={location.disasterGroup ?? ''}
          placeholder="e.g. Home city"
          onCommit={(value) => set({ disasterGroup: value.trim() === '' ? null : value })}
        />
        {groups.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {groups.map((group) => (
              <button
                key={group}
                type="button"
                className="chip hover:border-accent hover:text-strong"
                onClick={() => set({ disasterGroup: group })}
              >
                {group}
              </button>
            ))}
          </div>
        ) : null}
      </Field>

      <div className="space-y-3">
        <Toggle
          checked={location.requiresUserPresence}
          label="Needs you there in person"
          help="A bank box in your name alone. True on the day you need it back, and on the day somebody else does."
          onChange={(value) => set({ requiresUserPresence: value })}
        />
        <Toggle
          checked={location.tamperEvident}
          label="Tamper-evident"
          help="Sealed so that an opened container is visibly an opened container. This does not stop a theft; it means you find out."
          onChange={(value) => set({ tamperEvident: value })}
        />
      </div>

      {plan.people.length > 0 ? (
        <Field
          label="Who controls the door"
          help="Somebody other than you whose place this is. If they become unavailable, so does the place, however entitled you are to what is inside."
        >
          <Select
            value={location.custodianId}
            placeholder="Nobody but me"
            onChange={(personId) => set({ custodianId: personId })}
            options={plan.people.map((person) => ({ value: person.id, label: person.label }))}
          />
        </Field>
      ) : null}

      <div>
        <SectionHeading
          title="Who else can get in"
          hint="Access granted for a recovery is access available every day until then."
          actions={
            plan.people.length > 0 ? (
              <Button
                size="sm"
                icon={<Plus className="size-3.5" aria-hidden />}
                onClick={() =>
                  edit((draft) => {
                    const target = draft.locations.find((entry) => entry.id === location.id)
                    const unused = draft.people.find(
                      (person) => !target?.access.some((entry) => entry.personId === person.id)
                    )
                    if (target && unused) {
                      target.access.push({
                        personId: unused.id,
                        condition: 'after-death',
                        delayDays: 0,
                      })
                    }
                  })
                }
              >
                Add
              </Button>
            ) : null
          }
        />
        {plan.people.length === 0 ? (
          <p className="text-sm text-muted">
            No people are described yet. Add one under People first.
          </p>
        ) : location.access.length === 0 ? (
          <p className="text-sm text-muted">Nobody but you can get into {location.label}.</p>
        ) : (
          <ItemList
            items={location.access.map((access, position) => {
              const person = plan.people.find((entry) => entry.id === access.personId)
              return {
                id: `${access.personId}-${position}`,
                title: person?.label ?? 'Somebody',
                summary: describeAccess(access),
                removeLabel: `Remove ${person?.label ?? 'this'} access`,
                onRemove: () =>
                  edit((draft) => {
                    const target = draft.locations.find((entry) => entry.id === location.id)
                    if (target) target.access.splice(position, 1)
                  }),
                body: (
                  <>
                    <Field label="Who">
                      <Select
                        value={access.personId}
                        onChange={(personId) =>
                          edit((draft) => {
                            const target = draft.locations.find((entry) => entry.id === location.id)
                            if (target && personId) target.access[position].personId = personId
                          })
                        }
                        options={plan.people.map((entry) => ({
                          value: entry.id,
                          label: entry.label,
                        }))}
                      />
                    </Field>
                    <Field label="When">
                      <Select
                        value={access.condition}
                        onChange={(condition) =>
                          edit((draft) => {
                            const target = draft.locations.find((entry) => entry.id === location.id)
                            if (target && condition) target.access[position].condition = condition
                          })
                        }
                        options={CONDITIONS.map((condition) => ({
                          value: condition,
                          label: ACCESS_CONDITION[condition],
                        }))}
                      />
                    </Field>
                    {access.condition === 'after-death' ? (
                      <Field
                        label="Delay before it opens"
                        help="Probate, mostly. Real time during which nobody can act, and the reason a successor letter tells them to start the paperwork and then wait."
                      >
                        <PresetNumber
                          value={access.delayDays}
                          presets={PROBATE}
                          max={3650}
                          suffix="days"
                          onChange={(days) =>
                            edit((draft) => {
                              const target = draft.locations.find(
                                (entry) => entry.id === location.id
                              )
                              if (target) target.access[position].delayDays = days ?? 0
                            })
                          }
                        />
                      </Field>
                    ) : null}
                  </>
                ),
              }
            })}
          />
        )}
      </div>

      <Field label="Notes" help="Anything that is not a secret and not an address.">
        <GuardedInput
          multiline
          rows={3}
          value={location.notes}
          onCommit={(value) => set({ notes: value })}
        />
      </Field>
    </div>
  )
}
