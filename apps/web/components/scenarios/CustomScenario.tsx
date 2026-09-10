'use client'

import { useEffect, useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { baseWorld, without, type Plan, type World } from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { Field, NumberInput, Segmented, Toggle } from '@/components/ui/Field.tsx'
import { cn } from '@/lib/cn.ts'

/**
 * Compose your own failure.
 *
 * The list of worlds asks one question at a time, which is the right default
 * and is not how anything actually goes wrong: a fire takes a place *and* the
 * device that was in it, and the person you were going to call has moved.
 * This is the same evaluator with the switches exposed, so a combination
 * produces the same answer any single one of them would.
 *
 * It used to print its own verdicts underneath itself, which meant the app
 * answered the same question in two places and drew the picture in only one of
 * them. Now it hands the world it composed to whatever is drawing, and the
 * answer appears where every other answer appears.
 */
export function CustomScenario({
  plan,
  onChange,
}: {
  plan: Plan
  /** Called with the composed world, and with null once it is reset. */
  onChange: (world: World | null) => void
}) {
  const [goneLocations, setGoneLocations] = useState<string[]>([])
  const [goneObjects, setGoneObjects] = useState<string[]>([])
  const [gonePeople, setGonePeople] = useState<string[]>([])
  const [memory, setMemory] = useState(true)
  const [elapsedDays, setElapsedDays] = useState(0)
  const [side, setSide] = useState<'you' | 'them'>('you')

  const world = useMemo(() => {
    const base = baseWorld(plan, {
      label: 'A situation you made up',
      actor: side === 'you' ? 'user' : 'adversary',
      memory,
      elapsedDays,
      unknownPlacementReachable: side === 'you',
    })
    return without(base, {
      locations: goneLocations,
      objects: goneObjects,
      people: gonePeople,
    })
  }, [plan, goneLocations, goneObjects, gonePeople, memory, elapsedDays, side])

  const untouched =
    goneLocations.length === 0 &&
    goneObjects.length === 0 &&
    gonePeople.length === 0 &&
    memory &&
    elapsedDays === 0 &&
    side === 'you'

  // A composed world that is identical to today is not worth taking the
  // picture off the world the reader chose, so nothing is reported until at
  // least one switch has moved.
  useEffect(() => {
    onChange(untouched ? null : world)
  }, [onChange, untouched, world])

  const toggle = (list: string[], setList: (next: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id])

  const reset = () => {
    setGoneLocations([])
    setGoneObjects([])
    setGonePeople([])
    setMemory(true)
    setElapsedDays(0)
    setSide('you')
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label mb-1.5">Asking on behalf of</p>
        <Segmented
          value={side}
          onChange={setSide}
          options={[
            { value: 'you', label: 'You', hint: 'Can you still move the coins?' },
            { value: 'them', label: 'Someone else', hint: 'Can they move the coins?' },
          ]}
        />
        <p className="mt-1.5 text-xs leading-snug text-faint">
          {side === 'you'
            ? 'What is left is what you can still reach. Anything with no recorded place counts as findable, because you know where your own things are.'
            : 'What is ticked below is what they have got, and nothing else. Anything with no recorded place is not theirs.'}
        </p>
      </div>

      {plan.locations.length > 0 ? (
        <div>
          <p className="label mb-1.5">
            {side === 'you' ? 'Places you cannot reach' : 'Places they have opened'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.locations.map((location) => (
              <Chip
                key={location.id}
                label={location.label}
                active={goneLocations.includes(location.id)}
                onClick={() => toggle(goneLocations, setGoneLocations, location.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {plan.devices.length + plan.keys.length > 0 ? (
        <div>
          <p className="label mb-1.5">Objects that are gone</p>
          <div className="flex flex-wrap gap-1.5">
            {plan.devices.map((device) => (
              <Chip
                key={device.id}
                label={device.label}
                active={goneObjects.includes(device.id)}
                onClick={() => toggle(goneObjects, setGoneObjects, device.id)}
              />
            ))}
            {plan.keys.flatMap((key) =>
              key.backups.map((backup) => (
                <Chip
                  key={backup.id}
                  label={`${key.label} / ${backup.label}`}
                  active={goneObjects.includes(backup.id)}
                  onClick={() => toggle(goneObjects, setGoneObjects, backup.id)}
                />
              ))
            )}
          </div>
        </div>
      ) : null}

      {plan.people.length > 0 ? (
        <div>
          <p className="label mb-1.5">People who are not there</p>
          <div className="flex flex-wrap gap-1.5">
            {plan.people.map((person) => (
              <Chip
                key={person.id}
                label={person.label}
                active={gonePeople.includes(person.id)}
                onClick={() => toggle(gonePeople, setGonePeople, person.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <Toggle
        checked={!memory}
        label="Nothing memorised is available"
        help="What death, incapacity and a stranger holding your containers all have in common: the PINs, the memorised passphrases and the password on any encrypted archive are gone."
        onChange={(value) => setMemory(!value)}
      />

      <Field
        label="Days of inactivity"
        help="Only matters if a wallet has a timelocked path. That is the point of one."
      >
        <NumberInput
          value={elapsedDays}
          max={3650}
          suffix="days"
          onChange={(days) => setElapsedDays(days ?? 0)}
        />
      </Field>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs leading-snug text-faint">
          {untouched
            ? 'Nothing switched off yet, so the drawing is the world chosen above.'
            : 'The drawing above is this world.'}
        </p>
        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw className="size-3.5" aria-hidden />}
          onClick={reset}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'chip transition-colors',
        active
          ? 'border-critical/60 bg-critical/10 text-critical'
          : 'hover:border-line-strong hover:text-body'
      )}
    >
      {label}
    </button>
  )
}
