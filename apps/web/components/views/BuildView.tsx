'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CircleDot,
  FileText,
  KeyRound,
  Minus,
  Plus,
  Shuffle,
  Trash2,
  User,
} from 'lucide-react'
import {
  analyze,
  buildGraph,
  baseWorld,
  createContext,
  defaultShape,
  enumerateScenarios,
  keyLabel,
  PLACE_DEFAULTS,
  placeLabel,
  planFromShape,
  runScenario,
  spreadPlacement,
  type LocationKind,
  type Shape,
} from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { MEASURE, Panel, ViewHeader } from '@/components/ui/Surface.tsx'
import { PlanDiagram } from '@/components/graph/PlanDiagram.tsx'
import { FailureMatrix } from '@/components/graph/FailureMatrix.tsx'
import { SeverityBar, SeverityDot } from '@/components/ui/Severity.tsx'
import { useStore } from '@/lib/store.ts'
import { navigateTo } from '@/lib/router.ts'
import { LOCATION_KIND } from '@/lib/describe.ts'
import { cn } from '@/lib/cn.ts'

/**
 * A plan in one screen, by its shape.
 *
 * The seven design steps are the place to describe a setup exactly. They are a
 * poor place to start one: a hundred fields, most of them the same decision
 * for every key, before the program has said a single thing back. Here the
 * decisions are the few that vary, made by clicking, and the drawing and the
 * findings beside them are the real engine's answer to every click. What
 * comes out is an ordinary plan, and the design steps refine it.
 */

const PRESETS: { label: string; threshold: number; keys: number; collaborative: boolean }[] = [
  { label: 'One key', threshold: 1, keys: 1, collaborative: false },
  { label: '2 of 3', threshold: 2, keys: 3, collaborative: false },
  { label: '3 of 5', threshold: 3, keys: 5, collaborative: false },
  { label: '2 of 3, one held by a service', threshold: 2, keys: 3, collaborative: true },
]

const TRAVEL: { value: number; label: string }[] = [
  { value: 0, label: 'here' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 1440, label: 'a day' },
]

export function BuildView() {
  const addPlan = useStore((state) => state.addPlan)
  const [shape, setShape] = useState<Shape>(defaultShape)

  const plan = useMemo(() => planFromShape(shape), [shape])
  const report = useMemo(() => analyze(plan, { includeScenarios: false }), [plan])
  const results = useMemo(() => {
    const ctx = createContext(plan)
    return enumerateScenarios(ctx).map((scenario) => runScenario(ctx, scenario))
  }, [plan])
  const graph = useMemo(() => buildGraph(plan, baseWorld(plan), { includePeople: false }), [plan])

  const update = (change: Partial<Shape>) => setShape((current) => ({ ...current, ...change }))

  const setCounts = (threshold: number, keys: number, collaborative: boolean) => {
    const n = Math.max(1, Math.min(9, keys))
    const m = Math.max(1, Math.min(n, threshold))
    const held = collaborative && n > 1
    update({
      threshold: m,
      keys: n,
      collaborative: held,
      placement: spreadPlacement(n, shape.places.length, held),
    })
  }

  const setPlaces = (places: Shape['places']) => {
    const keep = (index: number | null) => (index !== null && index < places.length ? index : null)
    update({
      places,
      placement: shape.placement.map((entry) => ({
        device: keep(entry.device),
        backup: keep(entry.backup),
      })),
      configPlaces: shape.configPlaces.filter((index) => index < places.length),
      successorPlace: keep(shape.successorPlace),
    })
  }

  const toggle = (key: number, part: 'device' | 'backup', at: number) =>
    update({
      placement: shape.placement.map((entry, index) =>
        index === key ? { ...entry, [part]: entry[part] === at ? null : at } : entry
      ),
    })

  const create = () => {
    addPlan(planFromShape(shape))
    navigateTo('overview')
  }

  const multisig = shape.keys > 1
  const top = report.findings.slice(0, 5)

  return (
    <div className={MEASURE.wide}>
      <ViewHeader
        eyebrow="New plan"
        title="Build it by shape"
        question="Click the shape of your setup; the drawing and findings on the right are the real analysis, live. Everything can be refined afterwards in Design."
        actions={
          <Button
            variant="primary"
            onClick={create}
            icon={<ArrowRight className="size-4" aria-hidden />}
          >
            Create this plan
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Panel className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-strong">Keys</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((preset) => {
                const active =
                  preset.threshold === shape.threshold &&
                  preset.keys === shape.keys &&
                  preset.collaborative === shape.collaborative
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCounts(preset.threshold, preset.keys, preset.collaborative)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-[var(--radius-control)] border p-3 text-left transition-colors',
                      active ? 'border-accent bg-accent/10' : 'border-line hover:border-line-strong'
                    )}
                  >
                    <KeyDots
                      threshold={preset.threshold}
                      keys={preset.keys}
                      held={preset.collaborative}
                    />
                    <span className="text-xs font-medium leading-snug text-strong">
                      {preset.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <Stepper
                label="needed"
                value={shape.threshold}
                onChange={(value) => setCounts(value, shape.keys, shape.collaborative)}
              />
              <span>of</span>
              <Stepper
                label="keys"
                value={shape.keys}
                onChange={(value) => setCounts(shape.threshold, value, shape.collaborative)}
              />
              <label className="ml-auto flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={shape.hotWallet}
                  onChange={(event) => update({ hotWallet: event.target.checked })}
                />
                plus a phone wallet for spending
              </label>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-strong">Places</h2>
              <Button
                size="sm"
                icon={<Plus className="size-3.5" aria-hidden />}
                disabled={shape.places.length >= 8}
                onClick={() =>
                  setPlaces([...shape.places, { kind: 'other', ...PLACE_DEFAULTS.other }])
                }
              >
                Add place
              </Button>
            </div>
            <ul className="space-y-2">
              {shape.places.map((entry, index) => (
                <li
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-line px-2.5 py-2"
                >
                  <span className="mono w-12 flex-none text-xs font-medium text-strong">
                    {placeLabel(index)}
                  </span>
                  <select
                    aria-label={`${placeLabel(index)}: what it is`}
                    className="select min-w-0 flex-1 py-1 text-xs"
                    value={entry.kind}
                    onChange={(event) => {
                      const kind = event.target.value as LocationKind
                      setPlaces(
                        shape.places.map((current, at) =>
                          at === index ? { kind, ...PLACE_DEFAULTS[kind] } : current
                        )
                      )
                    }}
                  >
                    {Object.entries(LOCATION_KIND).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`${placeLabel(index)}: how far`}
                    className="select w-24 py-1 text-xs"
                    value={entry.travelMinutes}
                    onChange={(event) =>
                      setPlaces(
                        shape.places.map((current, at) =>
                          at === index
                            ? { ...current, travelMinutes: Number(event.target.value) }
                            : current
                        )
                      )
                    }
                  >
                    {TRAVEL.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-pressed={entry.far}
                    title="In another city or region: one fire, flood or court does not reach both"
                    onClick={() =>
                      setPlaces(
                        shape.places.map((current, at) =>
                          at === index ? { ...current, far: !current.far } : current
                        )
                      )
                    }
                    className={cn(
                      'chip transition-colors',
                      entry.far
                        ? 'border-accent bg-accent/10 text-strong'
                        : 'hover:border-line-strong'
                    )}
                  >
                    {entry.far ? 'other region' : 'same area'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${placeLabel(index)}`}
                    disabled={shape.places.length <= 1}
                    onClick={() => setPlaces(shape.places.filter((_, at) => at !== index))}
                    className="text-faint transition-colors hover:text-critical disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-strong">What goes where</h2>
              <Button
                size="sm"
                icon={<Shuffle className="size-3.5" aria-hidden />}
                onClick={() =>
                  update({
                    placement: spreadPlacement(
                      shape.keys,
                      shape.places.length,
                      shape.collaborative
                    ),
                    configPlaces: shape.places.map((_, index) => index),
                  })
                }
              >
                Spread it out
              </Button>
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full border-collapse text-xs" aria-label="What goes where">
                <thead>
                  <tr>
                    <th className="sr-only">Item</th>
                    {shape.places.map((_, index) => (
                      <th
                        key={index}
                        scope="col"
                        className="mono px-1 pb-1.5 text-center text-[0.6875rem] font-medium text-muted"
                      >
                        {placeLabel(index)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shape.placement.map((entry, key) => {
                    const held = shape.collaborative && key === shape.keys - 1
                    return (
                      <tr key={key} className="border-t border-line">
                        <th
                          scope="row"
                          className="whitespace-nowrap py-1.5 pr-3 text-left font-medium text-body"
                        >
                          {keyLabel(key)}
                        </th>
                        {held ? (
                          <td
                            colSpan={shape.places.length}
                            className="py-1.5 text-center text-faint"
                          >
                            held by the service
                          </td>
                        ) : (
                          shape.places.map((_, at) => (
                            <td key={at} className="px-1 py-1.5">
                              <span className="flex justify-center gap-1">
                                <Toggle
                                  on={entry.device === at}
                                  label={`${keyLabel(key)} device at ${placeLabel(at)}`}
                                  onClick={() => toggle(key, 'device', at)}
                                >
                                  <CircleDot className="size-3.5" aria-hidden />
                                </Toggle>
                                <Toggle
                                  on={entry.backup === at}
                                  label={`${keyLabel(key)} backup at ${placeLabel(at)}`}
                                  onClick={() => toggle(key, 'backup', at)}
                                >
                                  <KeyRound className="size-3.5" aria-hidden />
                                </Toggle>
                              </span>
                            </td>
                          ))
                        )}
                      </tr>
                    )
                  })}
                  {multisig ? (
                    <tr className="border-t border-line">
                      <th
                        scope="row"
                        className="whitespace-nowrap py-1.5 pr-3 text-left font-medium text-body"
                      >
                        Descriptor
                      </th>
                      {shape.places.map((_, at) => (
                        <td key={at} className="px-1 py-1.5">
                          <span className="flex justify-center">
                            <Toggle
                              on={shape.configPlaces.includes(at)}
                              label={`Descriptor copy at ${placeLabel(at)}`}
                              onClick={() =>
                                update({
                                  configPlaces: shape.configPlaces.includes(at)
                                    ? shape.configPlaces.filter((index) => index !== at)
                                    : [...shape.configPlaces, at].sort(),
                                })
                              }
                            >
                              <FileText className="size-3.5" aria-hidden />
                            </Toggle>
                          </span>
                        </td>
                      ))}
                    </tr>
                  ) : null}
                  <tr className="border-t border-line">
                    <th
                      scope="row"
                      className="whitespace-nowrap py-1.5 pr-3 text-left font-medium text-body"
                    >
                      Successor opens
                    </th>
                    {shape.places.map((_, at) => (
                      <td key={at} className="px-1 py-1.5">
                        <span className="flex justify-center">
                          <Toggle
                            on={shape.successorPlace === at}
                            label={`Successor can open ${placeLabel(at)} after you`}
                            onClick={() =>
                              update({ successorPlace: shape.successorPlace === at ? null : at })
                            }
                          >
                            <User className="size-3.5" aria-hidden />
                          </Toggle>
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-faint">
              <span className="flex items-center gap-1">
                <CircleDot className="size-3" aria-hidden /> signing device
              </span>
              <span className="flex items-center gap-1">
                <KeyRound className="size-3" aria-hidden /> steel backup
              </span>
              {multisig ? (
                <span className="flex items-center gap-1">
                  <FileText className="size-3" aria-hidden /> descriptor copy
                </span>
              ) : null}
            </p>
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-16 xl:self-start">
          <Panel className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-strong">What the analysis says, live</h2>
              <SeverityBar counts={report.counts} />
            </div>
            <PlanDiagram graph={graph} height="20rem" />
            {top.length > 0 ? (
              <ul className="mt-3 space-y-1.5" aria-live="polite">
                {top.map((finding) => (
                  <li
                    key={finding.id}
                    className="flex items-start gap-2 text-[0.8125rem] text-body"
                  >
                    <SeverityDot severity={finding.severity} className="mt-[0.45rem]" />
                    {finding.title}
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
          <Panel className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-strong">Every way it fails</h2>
            <FailureMatrix results={results} wallets={plan.wallets} />
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-[6px] border transition-colors',
        on
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-line text-faint opacity-50 hover:border-line-strong hover:opacity-100'
      )}
    >
      {children}
    </button>
  )
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-control)] border border-line">
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick={() => onChange(value - 1)}
        className="flex size-7 items-center justify-center text-muted hover:text-strong"
      >
        <Minus className="size-3" aria-hidden />
      </button>
      <span className="mono w-6 text-center text-sm text-strong" aria-label={`${value} ${label}`}>
        {value}
      </span>
      <button
        type="button"
        aria-label={`More ${label}`}
        onClick={() => onChange(value + 1)}
        className="flex size-7 items-center justify-center text-muted hover:text-strong"
      >
        <Plus className="size-3" aria-hidden />
      </button>
    </span>
  )
}

/** m of n, drawn: filled for the ones needed, hollow for the spares. */
function KeyDots({ threshold, keys, held }: { threshold: number; keys: number; held: boolean }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: keys }, (_, index) => (
        <KeyRound
          key={index}
          className={cn(
            'size-3.5',
            held && index === keys - 1
              ? 'text-muted'
              : index < threshold
                ? 'text-accent'
                : 'text-faint'
          )}
          strokeWidth={index < threshold ? 2.5 : 1.5}
        />
      ))}
    </span>
  )
}
