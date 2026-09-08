'use client'

import type { Concern, Plan } from '@outlive/core'
import { ChipSet, ChoiceGroup, Field, GuardedInput, Select } from '@/components/ui/Field.tsx'
import { Panel, SectionHeading } from '@/components/ui/Surface.tsx'
import { Implications } from '@/components/plan/Implications.tsx'
import { usePlanEdit } from '@/lib/edit.ts'
import { useStore } from '@/lib/store.ts'
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
 * The options carry their own consequences, and that is the point of them.
 *
 * These four answers govern real parts of the analysis: how long a recovery is
 * allowed to take, which backup media are viable, whether one court order
 * reaches everything, and whether being far from a site is the normal case. As
 * number fields they were answered with round numbers nobody meant. As
 * sentences that say what you are committing to, they get answered on purpose.
 */
const TOLERANCE = [
  {
    value: 0,
    label: 'The same day',
    consequence:
      'Every route has to be walkable this afternoon. A vault that opens on somebody else’s hours cannot be the only way in.',
  },
  {
    value: 7,
    label: 'Within a week',
    consequence: 'One journey, one appointment, one delayed flight. Not two of them in a row.',
  },
  {
    value: 30,
    label: 'Within about a month',
    consequence: 'Room for a trip abroad, a bank appointment and something going wrong on the way.',
  },
  {
    value: 90,
    label: 'Within a few months',
    consequence:
      'Long enough for a timelocked recovery path to open, which makes one a real option.',
  },
  {
    value: 365,
    label: 'It would not be urgent',
    consequence:
      'Nothing here is spent day to day. Say this only if a year of not being able to move is genuinely survivable.',
  },
]

const HORIZON = [
  {
    value: 5,
    label: 'Five years, while I am looking after it',
    consequence:
      'Paper and memory are survivable, because you are there to notice and replace them.',
  },
  {
    value: 15,
    label: 'Fifteen years',
    consequence:
      'Longer than most hardware lasts and most companies have existed. Media and counterparties start to matter.',
  },
  {
    value: 30,
    label: 'Thirty years',
    consequence:
      'Beyond the life of any device you own today. Every key needs something written on a durable medium.',
  },
  {
    value: 60,
    label: 'Past my own life',
    consequence:
      'Nothing memorised counts, because the memory goes first. Somebody else has to be able to finish it.',
  },
]

const JURISDICTIONS = [
  {
    value: 1,
    label: 'One',
    consequence:
      'One court order, one freeze, one change in the law reaches everything, however far apart the places are.',
  },
  {
    value: 2,
    label: 'Two',
    consequence:
      'A second legal system is a second independent failure, in a way a second city is not.',
  },
  {
    value: 3,
    label: 'Three or more',
    consequence:
      'Spread, at the cost of a recovery that has to cross borders, and heirs who have to as well.',
  },
]

const TRAVEL = [
  {
    value: 'home',
    label: 'Usually at home',
    consequence: 'Distances are measured from home, and that is where you usually are.',
  },
  {
    value: 'away',
    label: 'Away often',
    consequence:
      'Devices and backups cross borders, and being hours from a site is the normal case rather than the exception.',
  },
]

interface Choice {
  value: number
  label: string
  consequence: string
}

/**
 * A plan file can be hand-edited, and the number in it may not be one of the
 * answers offered here. Rather than silently rounding it, which would mean the
 * control and the panel beside it reporting different numbers, the exact value
 * is added as an option of its own, in order, and kept until it is changed.
 */
function withExact(options: Choice[], value: number, unit: string): Choice[] {
  if (options.some((option) => option.value === value)) return options
  return [
    ...options,
    { value, label: `${value} ${unit}`, consequence: 'As saved in your file.' },
  ].sort((a, b) => a.value - b.value)
}

export function ProfileEditor({ plan }: { plan: Plan }) {
  const edit = usePlanEdit()
  const renamePlan = useStore((state) => state.renamePlan)

  return (
    <div className="grid gap-4">
      <Panel className="space-y-4 p-4">
        <SectionHeading title="This plan" />
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <Field label="Name" help="Yours to recognise. It appears on every printed page.">
            <GuardedInput value={plan.name} onCommit={(name) => renamePlan(plan.id, name)} />
          </Field>
          <Field label="Kind" help="A draft is a candidate, compared against the one you run.">
            <Select
              value={plan.kind}
              onChange={(kind) =>
                edit((draft) => {
                  draft.kind = (kind ?? 'current') as Plan['kind']
                })
              }
              options={[
                { value: 'current', label: 'The plan I run' },
                { value: 'draft', label: 'A draft' },
              ]}
            />
          </Field>
        </div>
      </Panel>

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

      <Panel className="grid gap-5 p-4 lg:grid-cols-2">
        <Field label="How long could you go without being able to move coins?">
          <ChoiceGroup
            name="recovery-tolerance"
            value={plan.profile.recoveryToleranceDays}
            onChange={(days) =>
              edit((draft) => {
                draft.profile.recoveryToleranceDays = days
              })
            }
            options={withExact(TOLERANCE, plan.profile.recoveryToleranceDays, 'days')}
          />
        </Field>

        <Field label="How long does this have to keep working without you touching it?">
          <ChoiceGroup
            name="horizon"
            value={plan.profile.horizonYears}
            onChange={(years) =>
              edit((draft) => {
                draft.profile.horizonYears = years
              })
            }
            options={withExact(HORIZON, plan.profile.horizonYears, 'years')}
          />
        </Field>

        <Field label="How many legal systems does this plan sit in?">
          <ChoiceGroup
            name="jurisdictions"
            value={plan.profile.jurisdictionCount}
            onChange={(count) =>
              edit((draft) => {
                draft.profile.jurisdictionCount = count
              })
            }
            options={withExact(JURISDICTIONS, plan.profile.jurisdictionCount, 'systems')}
          />
        </Field>

        <Field label="Where are you, most of the time?">
          <ChoiceGroup
            name="travel"
            value={plan.profile.travelsFrequently ? 'away' : 'home'}
            onChange={(where) =>
              edit((draft) => {
                draft.profile.travelsFrequently = where === 'away'
              })
            }
            options={TRAVEL}
          />
        </Field>
      </Panel>

      {/* After the questions rather than beside them. Answering comes first and
          reading back what the answers meant comes second, which is the order
          the guided route already uses for every other step, and it gives the
          questions the whole column instead of two thirds of it. */}
      <Implications plan={plan} />
    </div>
  )
}
