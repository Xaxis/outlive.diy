'use client'

import type { Availability, Person, PersonRole, TechnicalSkill } from '@outlive/core'
import { Field, GuardedInput, Select, Toggle } from '@/components/ui/Field.tsx'
import { Callout } from '@/components/ui/Surface.tsx'
import { useEntityUpdater } from '@/lib/edit.ts'
import { PERSON_ROLE, SKILL } from '@/lib/describe.ts'

const ROLES = Object.keys(PERSON_ROLE) as PersonRole[]
const SKILLS = Object.keys(SKILL) as TechnicalSkill[]
const AVAILABILITY: { value: Availability; label: string }[] = [
  { value: 'immediate', label: 'Reachable straight away' },
  { value: 'days', label: 'Within days' },
  { value: 'weeks', label: 'Within weeks' },
  { value: 'unknown', label: 'Not sure' },
]

export function PersonInspector({ person }: { person: Person }) {
  const update = useEntityUpdater('person')
  const set = (patch: Partial<Person>) => update(person.id, patch)
  const isHeir = person.role === 'successor' || person.role === 'executor'

  return (
    <div className="space-y-5">
      <Field
        label="Label"
        help="A role, never a name. This file may end up somewhere you did not intend, and a role tells a stranger nothing."
      >
        <GuardedInput value={person.label} onCommit={(value) => set({ label: value })} />
      </Field>

      <Field label="Role">
        <Select
          value={person.role}
          onChange={(role) => set({ role: (role ?? 'aware') as PersonRole })}
          options={ROLES.map((role) => ({ value: role, label: PERSON_ROLE[role] }))}
        />
      </Field>

      <Field
        label="How technical are they"
        help="Not a judgement. It decides how far back the recovery instructions have to start, and they will be attempting it for the first time, under grief, with no way to ask you what you meant."
      >
        <Select
          value={person.technicalSkill}
          onChange={(skill) => set({ technicalSkill: (skill ?? 'none') as TechnicalSkill })}
          options={SKILLS.map((skill) => ({ value: skill, label: SKILL[skill] }))}
        />
      </Field>

      <Field label="How quickly could they act">
        <Select
          value={person.availability}
          onChange={(availability) =>
            set({ availability: (availability ?? 'unknown') as Availability })
          }
          options={AVAILABILITY}
        />
      </Field>

      {isHeir ? (
        <div className="space-y-3">
          <Toggle
            checked={person.knowsPlanExists}
            label="They know a plan exists"
            help="That sentence contains no secret, and without it every recovery route below is a route nobody starts walking."
            onChange={(value) =>
              set({
                knowsPlanExists: value,
                knowsWhereInstructionsAre: value ? person.knowsWhereInstructionsAre : false,
              })
            }
          />
          <Toggle
            checked={person.knowsWhereInstructionsAre}
            label="They know where the instructions are"
            help="The first step of every recovery is finding the paper."
            onChange={(value) =>
              set({
                knowsWhereInstructionsAre: value,
                knowsPlanExists: value || person.knowsPlanExists,
              })
            }
          />
        </div>
      ) : null}

      {person.role === 'key-agent' ? (
        <Callout tone="warn" title="A key held by a service is a counterparty">
          They can be compelled, go out of business, or change their terms. Assign them a key under
          Keys so the analysis knows the wallet depends on someone answering the phone.
        </Callout>
      ) : null}

      <Field label="Notes" help="No contact details. Those belong in the sealed instructions.">
        <GuardedInput
          multiline
          rows={3}
          value={person.notes}
          onCommit={(value) => set({ notes: value })}
        />
      </Field>
    </div>
  )
}
