'use client'

import { useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  daysBetween,
  findingsFor,
  today,
  type AnalysisReport,
  type Device,
  type Key,
  type Location,
  type Person,
  type Plan,
  type Severity,
  type Verification,
  type Wallet,
} from '@outlive/core'
import { Button } from '@/components/ui/Button.tsx'
import { Card, EmptyState, Panel } from '@/components/ui/Surface.tsx'
import { SeverityDot } from '@/components/ui/Severity.tsx'
import { LocationInspector } from './LocationInspector.tsx'
import { PersonInspector } from './PersonInspector.tsx'
import { DeviceInspector } from './DeviceInspector.tsx'
import { KeyInspector } from './KeyInspector.tsx'
import { WalletInspector } from './WalletInspector.tsx'
import { VerificationInspector } from './VerificationInspector.tsx'
import { entitiesOf, useStore, type EntityKind } from '@/lib/store.ts'
import { useRoute } from '@/lib/router.ts'
import {
  BACKUP_MEDIUM,
  DEVICE_KIND,
  describePolicy,
  describeTravel,
  LOCATION_KIND,
  PERSON_ROLE,
  SKILL,
  STAKE,
  TIER,
  VERIFICATION_KIND,
} from '@/lib/describe.ts'

/**
 * The list-and-inspector pair, used by both the design screens and the guided
 * route. One implementation, so that editing a key in the middle of the guided
 * flow is exactly the same act as editing it later.
 */
export function EntityWorkbench({
  plan,
  report,
  kind,
  singular,
  plural,
  blurb,
}: {
  plan: Plan
  report: AnalysisReport | null
  kind: EntityKind
  singular: string
  plural: string
  blurb: string
}) {
  const selection = useStore((state) => state.selection)
  const select = useStore((state) => state.select)
  const addEntity = useStore((state) => state.addEntity)
  const removeEntity = useStore((state) => state.removeEntity)

  const entities = entitiesOf(plan, kind)
  const selected = selection ? entities.find((entity) => entity.id === selection.id) : undefined

  useEffect(() => {
    if (selected || entities.length === 0) return
    select({ type: kind, id: entities[0].id })
  }, [kind, selected, entities, select])

  const add = () => {
    const id = addEntity(kind)
    if (id) select({ type: kind, id })
  }

  if (entities.length === 0) {
    return (
      <EmptyState
        title={`No ${plural.toLowerCase()} yet`}
        body={blurb}
        action={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={add}>
            Add the first one
          </Button>
        }
      />
    )
  }

  const worst = (id: string): Severity | null =>
    report ? (findingsFor(report, kind, id)[0]?.severity ?? null) : null

  return (
    // A text field one thousand pixels wide is a text field nobody can scan.
    // The inspector column stops at a readable measure and the row is left
    // aligned, rather than the form stretching to whatever the window is.
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,42rem)]">
      <div className="space-y-2">
        {/* On a phone this list sits above the form. Left uncapped, switching
            between keys means scrolling back past the whole of one. */}
        <ul className="max-h-[13rem] space-y-2 overflow-y-auto lg:max-h-none lg:overflow-visible">
          {entities.map((entity) => {
            const severity = worst(entity.id)
            return (
              <li key={entity.id}>
                <Card
                  selected={selected?.id === entity.id}
                  severity={severity}
                  className="p-3"
                  onClick={() => select({ type: kind, id: entity.id })}
                >
                  <div className="flex items-start gap-2">
                    {severity ? <SeverityDot severity={severity} className="mt-[0.4rem]" /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-strong">
                        {labelOf(kind, entity)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-faint">
                        {summarise(plan, kind, entity)}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
        <Button className="w-full" icon={<Plus className="size-3.5" aria-hidden />} onClick={add}>
          Add another
        </Button>
      </div>

      <Panel className="p-4">
        {selected ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <p className="eyebrow">{singular}</p>
                <h2 className="text-base font-semibold text-strong">{labelOf(kind, selected)}</h2>
              </div>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="size-3.5" aria-hidden />}
                onClick={() => removeEntity(kind, selected.id)}
              >
                Delete
              </Button>
            </div>
            <Inspector plan={plan} kind={kind} entity={selected} />
            <RelatedFindings report={report} kind={kind} id={selected.id} />
          </>
        ) : (
          <p className="text-sm text-muted">Choose something on the left.</p>
        )}
      </Panel>
    </div>
  )
}

function Inspector({ plan, kind, entity }: { plan: Plan; kind: EntityKind; entity: unknown }) {
  switch (kind) {
    case 'location':
      return <LocationInspector plan={plan} location={entity as Location} />
    case 'person':
      return <PersonInspector person={entity as Person} />
    case 'device':
      return <DeviceInspector plan={plan} device={entity as Device} />
    case 'key':
      return <KeyInspector plan={plan} entity={entity as Key} />
    case 'wallet':
      return <WalletInspector plan={plan} wallet={entity as Wallet} />
    case 'verification':
      return <VerificationInspector plan={plan} verification={entity as Verification} />
  }
}

function RelatedFindings({
  report,
  kind,
  id,
}: {
  report: AnalysisReport | null
  kind: EntityKind
  id: string
}) {
  const [, navigate] = useRoute()
  if (!report) return null
  const found = findingsFor(report, kind, id)
  if (found.length === 0) return null

  return (
    <div className="mt-6 border-t border-line pt-4">
      <p className="eyebrow mb-2">What the analysis says about this</p>
      <ul className="space-y-1.5">
        {found.map((finding) => (
          <li key={finding.id}>
            <button
              type="button"
              onClick={() => navigate({ view: 'findings', section: finding.id })}
              className="flex w-full items-start gap-2 text-left"
            >
              <SeverityDot severity={finding.severity} className="mt-[0.4rem]" />
              <span className="text-[0.8125rem] leading-snug text-muted hover:text-body">
                {finding.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function labelOf(kind: EntityKind, entity: unknown): string {
  if (kind === 'verification') return VERIFICATION_KIND[(entity as Verification).kind]
  return (entity as { label: string }).label
}

export function summarise(plan: Plan, kind: EntityKind, entity: unknown): string {
  switch (kind) {
    case 'location': {
      const location = entity as Location
      return [
        LOCATION_KIND[location.kind],
        describeTravel(location.travelMinutes),
        location.disasterGroup ?? 'no disaster group',
        location.access.length > 0
          ? `${location.access.length} with access`
          : 'nobody else can get in',
      ].join(' · ')
    }
    case 'person': {
      const person = entity as Person
      return `${PERSON_ROLE[person.role]} · ${SKILL[person.technicalSkill].toLowerCase()}`
    }
    case 'device': {
      const device = entity as Device
      return [
        DEVICE_KIND[device.kind],
        device.vendor ?? 'maker not recorded',
        device.airGapped ? 'air-gapped' : null,
        device.pin.storage === 'none' ? 'no PIN' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    }
    case 'key': {
      const key = entity as Key
      const device = plan.devices.find((entry) => entry.id === key.deviceId)
      return [
        device ? device.label : 'no device',
        key.backups.length === 0
          ? 'no backup'
          : key.backups.map((backup) => BACKUP_MEDIUM[backup.medium].toLowerCase()).join(', '),
        key.passphrase.enabled ? 'passphrase' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    }
    case 'wallet': {
      const wallet = entity as Wallet
      return `${TIER[wallet.tier]} · ${describePolicy(wallet)} · ${STAKE[wallet.stake].toLowerCase()}`
    }
    case 'verification': {
      const verification = entity as Verification
      if (verification.lastVerifiedAt === null) return 'never done'
      const age = daysBetween(verification.lastVerifiedAt, today())
      const overdue = age - verification.intervalDays
      return overdue > 0
        ? `${overdue} days overdue`
        : `done ${verification.lastVerifiedAt}, next in ${-overdue} days`
    }
  }
}
