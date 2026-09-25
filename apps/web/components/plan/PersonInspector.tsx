'use client'

import { NotesField } from '@/components/ui/NotesField.tsx'
import { Briefcase, Eye, Gavel, HeartHandshake, KeyRound, PenTool } from 'lucide-react'
import { cn } from '@/lib/cn.ts'

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

const ROLE_ICON: Record<PersonRole, typeof KeyRound> = {
  cosigner: PenTool,
  successor: HeartHandshake,
  executor: Gavel,
  'key-agent': KeyRound,
  aware: Eye,
  professional: Briefcase,
}

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
        <div role="radiogroup" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {ROLES.map((role) => {
            const Icon = ROLE_ICON[role]
            const on = person.role === role
            return (
              <button
                key={role}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ role })}
                className={cn(
                  'flex items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-2 text-left text-xs leading-tight transition-colors',
                  on
                    ? 'border-accent bg-accent/10 font-medium text-strong'
                    : 'border-line text-muted hover:border-line-strong hover:text-strong'
                )}
              >
                <Icon
                  className={cn('size-4 flex-none', on ? 'text-accent' : 'text-faint')}
                  aria-hidden
                />
                {PERSON_ROLE[role]}
              </button>
            )
          })}
        </div>
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

      <NotesField
        value={person.notes}
        onCommit={(value) => set({ notes: value })}
        help="No contact details. Those belong in the sealed instructions."
      />
    </div>
  )
}
