'use client'

import type { Concern, Plan } from '@outlive/core'
import { Field, NumberInput, ChipSet, Toggle } from '@/components/ui/Field.tsx'
import { Panel, SectionHeading } from '@/components/ui/Surface.tsx'
import { usePlanEdit } from '@/lib/edit.ts'
import { CONCERN } from '@/lib/describe.ts'

const CONCERNS: Concern[] = [
  'loss',
  'theft',
  'fire-flood',
  'death',
  'incapacity',
  'coercion',
  'insider',
  'legal-seizure',
  'supply-chain',
]

/**
 * What the plan is for.
 *
 * None of this suppresses a finding. It changes the order they are read in,
 * because a list that treats every risk as equally urgent is a list nobody
 * finishes. That distinction is stated on the screen, so nobody mistakes an
 * unticked box for a risk that has gone away.
 */
export function ProfileEditor({ plan }: { plan: Plan }) {
  const edit = usePlanEdit()

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-4">
        <SectionHeading
          title="What are you planning against?"
          hint="Everything is still analysed. This only decides what you read first."
        />
        <ChipSet
          values={plan.profile.concerns}
          onChange={(concerns) =>
            edit((draft) => {
              draft.profile.concerns = concerns
            })
          }
          options={CONCERNS.map((concern) => ({ value: concern, label: CONCERN[concern] }))}
        />
      </Panel>

      <Panel className="space-y-4 p-4">
        <SectionHeading title="How much disruption can you absorb?" />
        <Field
          label="Recovery tolerance"
          help="How long you could be unable to move coins after something goes wrong, before it becomes a real problem."
        >
          <NumberInput
            value={plan.profile.recoveryToleranceDays}
            min={0}
            max={3650}
            suffix="days"
            onChange={(days) =>
              edit((draft) => {
                draft.profile.recoveryToleranceDays = days ?? 0
              })
            }
          />
        </Field>
        <Field
          label="Horizon"
          help="How long this has to keep working without you maintaining it. Longer horizons make paper, memory and single vendors much worse bets."
        >
          <NumberInput
            value={plan.profile.horizonYears}
            min={0}
            max={200}
            suffix="years"
            onChange={(years) =>
              edit((draft) => {
                draft.profile.horizonYears = years ?? 0
              })
            }
          />
        </Field>
        <Field
          label="Jurisdictions"
          help="How many legal systems this plan spans. One is a correlation most people do not see."
        >
          <NumberInput
            value={plan.profile.jurisdictionCount}
            min={1}
            max={50}
            onChange={(count) =>
              edit((draft) => {
                draft.profile.jurisdictionCount = count ?? 1
              })
            }
          />
        </Field>
        <Toggle
          checked={plan.profile.travelsFrequently}
          label="I travel often"
          help="Which means devices and backups cross borders, and being far from a site is normal rather than exceptional."
          onChange={(value) =>
            edit((draft) => {
              draft.profile.travelsFrequently = value
            })
          }
        />
      </Panel>
    </div>
  )
}
