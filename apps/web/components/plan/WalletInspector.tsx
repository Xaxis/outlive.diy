'use client'

import { Plus } from 'lucide-react'
import {
  createConfigBackup,
  createSpendPath,
  isMultisig,
  type BackupMedium,
  type Plan,
  type SpendPath,
  type SpendPathKind,
  type Stake,
  type Wallet,
  type WalletConfigBackup,
  type WalletTier,
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
import { BACKUP_MEDIUM, PATH_KIND, STAKE, TIER, TIER_NOTE } from '@/lib/describe.ts'
import { PolicyTimeline } from './PolicyTimeline.tsx'

const TIERS = Object.keys(TIER) as WalletTier[]
const STAKES = Object.keys(STAKE) as Stake[]
const PATH_KINDS = Object.keys(PATH_KIND) as SpendPathKind[]
const MEDIA = Object.keys(BACKUP_MEDIUM) as BackupMedium[]

function PathEditor({
  plan,
  walletId,
  path,
  position,
}: {
  plan: Plan
  walletId: string
  path: SpendPath
  position: number
}) {
  const edit = usePlanEdit()
  const patch = (recipe: (path: SpendPath) => void) =>
    edit((draft) => {
      const wallet = draft.wallets.find((entry) => entry.id === walletId)
      const target = wallet?.paths[position]
      if (target) recipe(target)
    })

  const short = path.threshold > path.keyIds.length

  return (
    <>
      <Field label="Name">
        <GuardedInput
          ariaLabel="Spend path name"
          value={path.label}
          onCommit={(value) => patch((entry) => void (entry.label = value))}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What it is for">
          <Select
            value={path.kind}
            onChange={(kind) =>
              patch((entry) => void (entry.kind = (kind ?? 'primary') as SpendPathKind))
            }
            options={PATH_KINDS.map((kind) => ({ value: kind, label: PATH_KIND[kind] }))}
          />
        </Field>
        <Field label="Signatures needed">
          <NumberInput
            value={path.threshold}
            min={1}
            max={32}
            suffix={`of ${path.keyIds.length}`}
            onChange={(threshold) => patch((entry) => void (entry.threshold = threshold ?? 1))}
          />
        </Field>
      </div>

      <Field label="Keys on this path">
        {plan.keys.length === 0 ? (
          <p className="text-sm text-muted">No keys described yet.</p>
        ) : (
          <ChipSet
            values={path.keyIds}
            onChange={(keyIds) => patch((entry) => void (entry.keyIds = keyIds))}
            options={plan.keys.map((key) => ({ value: key.id, label: key.label }))}
          />
        )}
      </Field>

      <Field
        label="Timelock"
        help="Days of inactivity before this path opens. Zero for an everyday path. A timelocked path is the only thing in a custody plan that makes an attacker wait."
      >
        <NumberInput
          value={path.timelockDays}
          max={3650}
          suffix="days"
          onChange={(days) => patch((entry) => void (entry.timelockDays = days ?? 0))}
        />
      </Field>

      {short ? (
        <Callout tone="danger">
          This path needs {path.threshold} signatures from {path.keyIds.length}{' '}
          {path.keyIds.length === 1 ? 'key' : 'keys'}. Nobody can satisfy it, including you.
        </Callout>
      ) : null}
    </>
  )
}

/** What a way to spend says when its row is shut. */
function describePath(path: SpendPath): string {
  const policy = `${path.threshold} of ${path.keyIds.length}`
  const when = path.timelockDays > 0 ? `opens after ${path.timelockDays} days` : 'available now'
  // Most paths are named after their kind, and "Inheritance: inheritance" is a
  // summary line spending a third of itself saying nothing.
  const kind = PATH_KIND[path.kind].toLowerCase()
  const named = kind === path.label.trim().toLowerCase()
  return [policy, named ? null : kind, when].filter(Boolean).join(' · ')
}

/** And a configuration copy. */
function describeConfigCopy(plan: Plan, backup: WalletConfigBackup): string {
  const where = backup.locationId
    ? (plan.locations.find((entry) => entry.id === backup.locationId)?.label ?? 'somewhere')
    : 'no place recorded'
  return `${BACKUP_MEDIUM[backup.medium].toLowerCase()} · ${where}`
}

export function WalletInspector({ plan, wallet }: { plan: Plan; wallet: Wallet }) {
  const update = useEntityUpdater('wallet')
  const edit = usePlanEdit()
  const set = (patch: Partial<Wallet>) => update(wallet.id, patch)
  const multisig = isMultisig(wallet)

  return (
    <div className="space-y-5">
      <Field label="Label">
        <GuardedInput value={wallet.label} onCommit={(value) => set({ label: value })} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tier" help={TIER_NOTE[wallet.tier]}>
          <Select
            value={wallet.tier}
            onChange={(tier) => set({ tier: (tier ?? 'vault') as WalletTier })}
            options={TIERS.map((tier) => ({ value: tier, label: TIER[tier] }))}
          />
        </Field>
        <Field
          label="Share of the total"
          help="A proportion, never an amount. No balance is stored."
        >
          <Select
            value={wallet.stake}
            onChange={(stake) => set({ stake: (stake ?? 'moderate') as Stake })}
            options={STAKES.map((stake) => ({ value: stake, label: STAKE[stake] }))}
          />
        </Field>
      </div>

      <Toggle
        checked={wallet.decoy}
        label="This is a decoy"
        help="A wallet that exists to be surrendered. It holds a real, small balance so that handing it over under compulsion is credible. Findings about it are ranked down, because losing it is the plan."
        onChange={(value) => set({ decoy: value })}
      />

      <div>
        <SectionHeading
          title="Ways to spend"
          hint="A plain m-of-n has one. An inheritance policy has two."
          actions={
            <Button
              size="sm"
              icon={<Plus className="size-3.5" aria-hidden />}
              onClick={() =>
                edit((draft) => {
                  const target = draft.wallets.find((entry) => entry.id === wallet.id)
                  target?.paths.push(
                    createSpendPath({
                      label: 'Inheritance',
                      kind: 'inheritance',
                      threshold: 1,
                      keyIds: [],
                      timelockDays: 180,
                    })
                  )
                })
              }
            >
              Add a path
            </Button>
          }
        />
        {wallet.paths.length > 0 ? (
          <div className="mb-3">
            <PolicyTimeline wallet={wallet} />
          </div>
        ) : null}

        {wallet.paths.length === 0 ? (
          <Callout tone="danger">
            {wallet.label} has no spend path, so the plan does not describe any combination of keys
            that could move its coins.
          </Callout>
        ) : (
          <ItemList
            items={wallet.paths.map((path, position) => ({
              id: path.id,
              title: path.label,
              summary: describePath(path),
              removeLabel: `Remove ${path.label}`,
              // The last way to spend cannot go: a wallet with none is a
              // description of coins nobody can move, and the editor should
              // not be the thing that makes one.
              onRemove:
                wallet.paths.length > 1
                  ? () =>
                      edit((draft) => {
                        const target = draft.wallets.find((entry) => entry.id === wallet.id)
                        target?.paths.splice(position, 1)
                      })
                  : undefined,
              body: <PathEditor plan={plan} walletId={wallet.id} path={path} position={position} />,
            }))}
          />
        )}
      </div>

      {multisig ? (
        <div>
          <SectionHeading
            title="Wallet configuration backups"
            hint="The descriptor: participant public keys, derivation paths, policy."
            actions={
              <Button
                size="sm"
                icon={<Plus className="size-3.5" aria-hidden />}
                onClick={() =>
                  edit((draft) => {
                    const target = draft.wallets.find((entry) => entry.id === wallet.id)
                    target?.configBackups.push(createConfigBackup({ label: 'Printed descriptor' }))
                  })
                }
              >
                Add a copy
              </Button>
            }
          />
          {wallet.configBackups.length === 0 ? (
            <Callout tone="danger" title="A threshold of seeds is not enough">
              Without the descriptor there is no wallet to restore them into. This is the single
              most common way a well-built multisig turns out to be unrecoverable. It holds no
              secret, so it can be stored more widely than a seed, and it must be.
            </Callout>
          ) : (
            <ItemList
              items={wallet.configBackups.map((backup, position) => ({
                id: backup.id,
                title: backup.label,
                summary: describeConfigCopy(plan, backup),
                removeLabel: `Remove ${backup.label}`,
                onRemove: () =>
                  edit((draft) => {
                    const target = draft.wallets.find((entry) => entry.id === wallet.id)
                    target?.configBackups.splice(position, 1)
                  }),
                body: (
                  <>
                    <Field label="Name">
                      <GuardedInput
                        ariaLabel="Configuration copy name"
                        value={backup.label}
                        onCommit={(value) =>
                          edit((draft) => {
                            const target = draft.wallets.find((entry) => entry.id === wallet.id)
                            const copy = target?.configBackups[position]
                            if (copy) copy.label = value
                          })
                        }
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Medium">
                        <Select
                          value={backup.medium}
                          onChange={(medium) =>
                            edit((draft) => {
                              const target = draft.wallets.find((entry) => entry.id === wallet.id)
                              const copy = target?.configBackups[position]
                              if (copy) copy.medium = (medium ?? 'paper') as BackupMedium
                            })
                          }
                          options={MEDIA.map((medium) => ({
                            value: medium,
                            label: BACKUP_MEDIUM[medium],
                          }))}
                        />
                      </Field>
                      <Field label="Where it is">
                        <Select
                          value={backup.locationId}
                          placeholder="Not recorded"
                          onChange={(locationId) =>
                            edit((draft) => {
                              const target = draft.wallets.find((entry) => entry.id === wallet.id)
                              const copy = target?.configBackups[position]
                              if (copy) copy.locationId = locationId
                            })
                          }
                          options={plan.locations.map((location) => ({
                            value: location.id,
                            label: location.label,
                          }))}
                        />
                      </Field>
                    </div>
                  </>
                ),
              }))}
            />
          )}
        </div>
      ) : null}

      <Field label="Notes">
        <GuardedInput
          multiline
          rows={3}
          value={wallet.notes}
          onCommit={(value) => set({ notes: value })}
        />
      </Field>
    </div>
  )
}
