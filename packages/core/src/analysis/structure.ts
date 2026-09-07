/**
 * Structure: whether the plan describes something that could work at all.
 *
 * These run before any scenario, because a wallet with a threshold higher than
 * its key count does not need a fire to fail. Several of them fire on a plan
 * that is merely unfinished, and that is intended: an incomplete description
 * produces an incomplete analysis, and the user is entitled to know which.
 */

import type { Finding } from './findings.ts'
import { escalate, makeFinding, walletWeight } from './findings.ts'
import type { AnalysisContext } from './context.ts'
import { isMultisig, splitGroups, walletKeyIds, walletsUsingKey } from '../model/selectors.ts'
import type { Backup, Key } from '../model/types.ts'

function list(items: readonly string[]): string {
  if (items.length === 0) return 'nothing'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function analyseStructure(ctx: AnalysisContext): Finding[] {
  const { plan, index } = ctx
  const findings: Finding[] = []
  const add = (finding: Finding) => findings.push(finding)
  const locationOf = (id: string | null) => (id ? (index.locations.get(id)?.label ?? id) : null)

  for (const wallet of plan.wallets) {
    const weight = walletWeight(wallet)

    if (wallet.paths.length === 0) {
      add(
        makeFinding(plan, {
          rule: 'S001',
          key: wallet.id,
          title: `${wallet.label} has no way to spend`,
          detail: `${wallet.label} has no spend path, so the plan does not describe any combination of keys that could move its coins.`,
          remediation: `Add a spend path to ${wallet.label} and assign keys to it.`,
          subjects: [{ type: 'wallet', id: wallet.id }],
        })
      )
      continue
    }

    for (const path of wallet.paths) {
      if (path.threshold > path.keyIds.length) {
        add(
          makeFinding(plan, {
            rule: 'S002',
            key: `${wallet.id}:${path.id}`,
            title: `${wallet.label} / ${path.label} needs more keys than it has`,
            detail: `The path requires ${path.threshold} signatures from ${path.keyIds.length} ${path.keyIds.length === 1 ? 'key' : 'keys'}. Nobody can satisfy it, including you.`,
            remediation: `Lower the threshold to at most ${path.keyIds.length}, or add ${path.threshold - path.keyIds.length} more ${path.threshold - path.keyIds.length === 1 ? 'key' : 'keys'}.`,
            subjects: [
              { type: 'wallet', id: wallet.id },
              { type: 'path', id: path.id },
            ],
          })
        )
      }

      if (path.keyIds.length === 0) {
        add(
          makeFinding(plan, {
            rule: 'S003',
            key: `${wallet.id}:${path.id}`,
            title: `${wallet.label} / ${path.label} has no keys`,
            detail: 'The path is defined but nothing is assigned to it.',
            remediation: `Assign keys to ${path.label}, or delete the path.`,
            subjects: [
              { type: 'wallet', id: wallet.id },
              { type: 'path', id: path.id },
            ],
          })
        )
      }

      // A quorum spread across keys that share one device is not a quorum.
      const byDevice = new Map<string, Key[]>()
      for (const keyId of path.keyIds) {
        const key = index.keys.get(keyId)
        if (!key?.deviceId) continue
        const existing = byDevice.get(key.deviceId)
        if (existing) existing.push(key)
        else byDevice.set(key.deviceId, [key])
      }
      for (const [deviceId, keys] of byDevice) {
        if (keys.length < 2 || path.threshold < 2) continue
        const device = index.devices.get(deviceId)
        add(
          makeFinding(plan, {
            rule: 'S012',
            key: `${wallet.id}:${path.id}:${deviceId}`,
            title: `${device?.label ?? 'One device'} signs for ${keys.length} keys in ${wallet.label}`,
            detail: `${path.label} reads as ${path.threshold}-of-${path.keyIds.length}, but ${list(keys.map((k) => k.label))} all live on ${device?.label ?? 'the same device'}. Losing or seizing that one device takes ${keys.length} of the ${path.threshold} signatures at once.`,
            remediation: `Move ${list(keys.slice(1).map((k) => k.label))} onto separate devices, or reduce the path to reflect the independence it actually has.`,
            subjects: [
              { type: 'wallet', id: wallet.id },
              { type: 'device', id: deviceId },
              ...keys.map((k) => ({ type: 'key' as const, id: k.id })),
            ],
          })
        )
      }
    }

    if (walletKeyIds(wallet).length === 1 && wallet.tier === 'vault') {
      add(
        makeFinding(plan, {
          rule: 'S004',
          key: wallet.id,
          title: `${wallet.label} is a single-key vault`,
          detail: `${wallet.label} is your vault tier and depends on one key. Loss and theft both come down to one object.`,
          remediation:
            'Either move to a multisig policy, or record explicitly that this is a considered single-signature choice and make its backup redundancy carry the weight instead.',
          subjects: [{ type: 'wallet', id: wallet.id }],
          severity: escalate('medium', Math.max(0, weight)),
        })
      )
    }

    if (isMultisig(wallet)) {
      const storedOnDevice = walletKeyIds(wallet).some((keyId) => {
        const key = index.keys.get(keyId)
        const device = key?.deviceId ? index.devices.get(key.deviceId) : undefined
        return device?.storesWalletConfig === true
      })
      if (wallet.configBackups.length === 0 && !storedOnDevice) {
        add(
          makeFinding(plan, {
            rule: 'S010',
            key: wallet.id,
            title: `${wallet.label} has no wallet configuration backup`,
            detail: `${wallet.label} is multisig, so recovering it needs the descriptor: the participant extended public keys, the derivation paths and the policy. None of the plan's devices is recorded as storing it and no copy is written down anywhere. With every seed in hand and no descriptor, the coins stay where they are.`,
            remediation: `Export the wallet configuration and store copies at two locations that do not share a disaster group, then add them to ${wallet.label}.`,
            subjects: [{ type: 'wallet', id: wallet.id }],
          })
        )
      }
    }

    if (wallet.tier === 'hot' && wallet.stake === 'large' && !wallet.decoy) {
      add(
        makeFinding(plan, {
          rule: 'S016',
          key: wallet.id,
          title: `${wallet.label} keeps a large share on a hot wallet`,
          detail: `${wallet.label} is marked hot and carries a large share of the total. A hot key is exposed to everything the machine holding it is exposed to.`,
          remediation:
            'Move the bulk into the vault tier and leave the hot wallet only what you would shrug at losing.',
          subjects: [{ type: 'wallet', id: wallet.id }],
        })
      )
    }

    if (wallet.paths.length > 0 && wallet.paths.every((path) => path.timelockDays > 0)) {
      const soonest = Math.min(...wallet.paths.map((path) => path.timelockDays))
      add(
        makeFinding(plan, {
          rule: 'S020',
          key: wallet.id,
          title: `${wallet.label} cannot be spent for ${soonest} days`,
          detail: `Every spend path on ${wallet.label} is timelocked. There is no route that opens today, including for you, including in an emergency.`,
          remediation: `Add an untimelocked path to ${wallet.label}, or confirm deliberately that the delay is the point.`,
          subjects: [{ type: 'wallet', id: wallet.id }],
        })
      )
    }
  }

  // --- keys -----------------------------------------------------------------

  const vaultKeyIds = new Set(
    plan.wallets.filter((w) => w.tier === 'vault').flatMap((w) => walletKeyIds(w))
  )

  for (const key of plan.keys) {
    const wallets = walletsUsingKey(plan, key.id)
    const weight = wallets.length ? Math.max(...wallets.map(walletWeight)) : 0

    if (!key.deviceId && key.backups.length === 0) {
      add(
        makeFinding(plan, {
          rule: 'S005',
          key: key.id,
          title: `${key.label} has nothing behind it`,
          detail: `${key.label} has neither a device nor a backup. Nothing in this plan can produce that signature.`,
          remediation: `Record the device ${key.label} lives on, a written backup of it, or both.`,
          subjects: [{ type: 'key', id: key.id }],
        })
      )
    } else if (key.deviceId && key.backups.length === 0) {
      add(
        makeFinding(plan, {
          rule: 'S006',
          key: key.id,
          title: `${key.label} exists only on its device`,
          detail: `${key.label} has no written backup. A dead battery, a failed firmware update, a fall, or a customs officer removes it permanently.`,
          remediation: `Write ${key.label} down on a durable medium and place it somewhere that does not share a disaster group with the device.`,
          subjects: [{ type: 'key', id: key.id }],
          severity: escalate('high', Math.max(0, weight)),
        })
      )
    }

    for (const backup of key.backups) {
      if (backup.medium === 'paper' && vaultKeyIds.has(key.id)) {
        add(
          makeFinding(plan, {
            rule: 'S007',
            key: backup.id,
            title: `${key.label} / ${backup.label} is on paper`,
            detail: `${backup.label} backs a vault-tier key on paper${
              locationOf(backup.locationId) ? ` at ${locationOf(backup.locationId)}` : ''
            }. Paper loses to fire, water and thirty years of humidity.`,
            remediation:
              'Transfer it to steel or another fire-and-water durable medium, then destroy the paper.',
            subjects: [
              { type: 'key', id: key.id },
              { type: 'backup', id: backup.id },
            ],
          })
        )
      }
      if (backup.medium === 'plain-digital') {
        add(
          makeFinding(plan, {
            rule: 'S008',
            key: backup.id,
            title: `${key.label} / ${backup.label} is an unencrypted file`,
            detail: `${backup.label} holds key material in plain digital form. Files are copied by backup software, sync clients, disk images and anything that has ever had read access, and none of those copies announce themselves.`,
            remediation:
              'Destroy the file, wipe its backups, and treat the key as compromised: move the coins to a wallet built from fresh keys.',
            subjects: [
              { type: 'key', id: key.id },
              { type: 'backup', id: backup.id },
            ],
            severity: escalate('high', Math.max(0, weight)),
          })
        )
      }
      if (backup.medium !== 'memorized' && backup.locationId === null) {
        add(
          makeFinding(plan, {
            rule: 'S009',
            key: backup.id,
            title: `${key.label} / ${backup.label} has no recorded location`,
            detail:
              'It is excluded from every location, correlation and coercion result below, so those results are optimistic by exactly this much.',
            remediation: `Set the location for ${backup.label}.`,
            subjects: [
              { type: 'key', id: key.id },
              { type: 'backup', id: backup.id },
            ],
          })
        )
      }
    }

    for (const [groupId, group] of splitGroups(key)) {
      if (group.shares.length < group.threshold) {
        add(
          makeFinding(plan, {
            rule: 'S011',
            key: `${key.id}:${groupId}`,
            title: `${key.label} is split into fewer shares than it needs`,
            detail: `The split needs ${group.threshold} shares and the plan records ${group.shares.length}. The secret is already unrecoverable.`,
            remediation: `Record the missing shares, or lower the threshold to ${group.shares.length} if that is what was actually generated.`,
            subjects: [{ type: 'key', id: key.id }],
          })
        )
      }
    }

    if (key.deviceId && key.deviceLocationId === null) {
      add(
        makeFinding(plan, {
          rule: 'S009',
          key: `${key.id}:device-place`,
          title: `${key.label}'s device has no recorded location`,
          detail:
            'It is excluded from the location, correlation and coercion analysis, which makes those results optimistic.',
          remediation: `Set where ${index.devices.get(key.deviceId)?.label ?? 'the device'} is kept.`,
          subjects: [{ type: 'key', id: key.id }],
        })
      )
    }

    // --- passphrase -------------------------------------------------------
    if (key.passphrase.enabled) {
      if (key.passphrase.storage === 'memorized' && key.passphrase.knownBy.length === 0) {
        add(
          makeFinding(plan, {
            rule: 'S013',
            key: key.id,
            title: `${key.label}'s passphrase exists only in your memory`,
            detail: `Nothing is written and nobody else knows it. Every backup of ${key.label} is inert without it, so the coins behind ${list(wallets.map((w) => w.label))} depend on one unbacked copy in one head.`,
            remediation:
              'Either write the passphrase down and store it away from every seed backup, split it across locations, or accept explicitly that this key dies with your memory of it.',
            subjects: [{ type: 'key', id: key.id }],
            severity: escalate('high', Math.max(0, weight)),
          })
        )
      }
      const backupPlaces = new Set(
        key.backups.map((backup) => backup.locationId).filter((id): id is string => id !== null)
      )
      const collisions = key.passphrase.locationIds.filter((id) => backupPlaces.has(id))
      if (collisions.length > 0) {
        add(
          makeFinding(plan, {
            rule: 'S014',
            key: key.id,
            title: `${key.label}'s passphrase is kept with its seed`,
            detail: `Both the seed backup and the passphrase are at ${list(collisions.map((id) => locationOf(id) ?? id))}. Whoever opens that container has the whole key, so the passphrase costs you a step and costs an attacker nothing.`,
            remediation: 'Move the passphrase to a location that holds no backup of this key.',
            subjects: [{ type: 'key', id: key.id }],
          })
        )
      }
    }
  }

  // --- a key doing duty in two tiers ----------------------------------------
  //
  // Tiers exist so that the exposure of the loose one does not reach the
  // careful one. A key in both is a hole straight through that.
  for (const key of plan.keys) {
    const using = walletsUsingKey(plan, key.id).filter((wallet) => !wallet.decoy)
    const hot = using.filter((wallet) => wallet.tier === 'hot')
    const cold = using.filter((wallet) => wallet.tier === 'vault')
    if (hot.length === 0 || cold.length === 0) continue
    add(
      makeFinding(plan, {
        rule: 'S023',
        key: key.id,
        title: `${key.label} spends both ${list(hot.map((w) => w.label))} and ${list(cold.map((w) => w.label))}`,
        detail: `${key.label} is used by a hot wallet and by a vault. A hot key lives on a machine that opens email, so ${list(cold.map((w) => w.label))} has quietly inherited that machine's exposure for one of its keys, and whoever takes the easy one is then a single key from the hard one.`,
        remediation: `Give ${list(hot.map((w) => w.label))} its own key, generated separately, and remove ${key.label} from it.`,
        subjects: [
          { type: 'key', id: key.id },
          ...using.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        ],
      })
    )
  }

  // --- what the horizon costs -----------------------------------------------
  //
  // The horizon is how long the plan has to keep working without anybody
  // maintaining it. Over a decade or two it stops being a number and starts
  // deciding which media and which counterparties are viable at all.

  const HORIZON_MEDIUM_YEARS = 15
  const DURABLE: Backup['medium'][] = ['steel']

  if (plan.profile.horizonYears >= HORIZON_MEDIUM_YEARS) {
    const fragile = plan.keys.filter(
      (key) =>
        key.backups.length > 0 && !key.backups.some((backup) => DURABLE.includes(backup.medium))
    )
    if (fragile.length > 0) {
      add(
        makeFinding(plan, {
          rule: 'S021',
          key: 'horizon-medium',
          title: `${list(fragile.map((key) => key.label))} ${fragile.length === 1 ? 'has' : 'have'} no backup expected to last ${plan.profile.horizonYears} years`,
          detail: `The plan has to keep working for ${plan.profile.horizonYears} years without maintenance, and ${
            fragile.length === 1 ? 'this key is' : 'these keys are'
          } written only on ${list([
            ...new Set(
              fragile.flatMap((key) =>
                key.backups.map((backup) => backup.medium.replace(/-/g, ' '))
              )
            ),
          ])}. Over that period paper browns and gets cleared out, and a file outlives the format, the device or the person who knew it was there.`,
          remediation:
            'Add one backup on a fire-and-water durable medium per key, and treat the existing copies as convenience rather than survival.',
          subjects: fragile.map((key) => ({ type: 'key' as const, id: key.id })),
        })
      )
    }
  }

  const HORIZON_COUNTERPARTY_YEARS = 15
  if (plan.profile.horizonYears >= HORIZON_COUNTERPARTY_YEARS) {
    const agents = plan.people.filter((person) => person.role === 'key-agent')
    const services = plan.devices.filter((device) => device.kind === 'service-cosigner')
    const dependent = plan.keys.filter(
      (key) =>
        (key.heldBy !== null && agents.some((person) => person.id === key.heldBy)) ||
        services.some((device) => device.id === key.deviceId)
    )
    if (dependent.length > 0) {
      add(
        makeFinding(plan, {
          rule: 'S022',
          key: 'horizon-counterparty',
          title: `${list(dependent.map((key) => key.label))} depends on a company for ${plan.profile.horizonYears} years`,
          detail: `A business is not a durable object on that timescale. It is acquired, changes its terms, is compelled by somebody else, or stops answering, and none of those arrive with notice.`,
          remediation: `Make sure ${list(dependent.map((key) => key.label))} is replaceable: a spend path that works without it, or a documented route to withdraw before the arrangement ends.`,
          subjects: dependent.map((key) => ({ type: 'key' as const, id: key.id })),
        })
      )
    }
  }

  // --- devices --------------------------------------------------------------

  for (const device of plan.devices) {
    if (device.pin.storage !== 'written' || device.pin.locationId === null) continue
    const together = plan.keys.filter(
      (key) => key.deviceId === device.id && key.deviceLocationId === device.pin.locationId
    )
    if (together.length === 0) continue
    add(
      makeFinding(plan, {
        rule: 'S019',
        key: device.id,
        title: `${device.label}'s PIN is written where the device is kept`,
        detail: `Both sit at ${locationOf(device.pin.locationId)}. The PIN is the only thing that makes possession of the device insufficient, and it is in the same container.`,
        remediation: `Move the written PIN to a different location, or memorise it and remove the written copy.`,
        subjects: [{ type: 'device', id: device.id }],
      })
    )
  }

  // --- people and places ----------------------------------------------------

  const hasSuccessor = plan.people.some(
    (person) => person.role === 'successor' || person.role === 'executor'
  )
  if (!hasSuccessor && plan.profile.concerns.includes('death') && plan.wallets.length > 0) {
    add(
      makeFinding(plan, {
        rule: 'S015',
        key: 'plan',
        title: 'Death is a stated concern and no successor is described',
        detail:
          'The plan names nobody who could act after you. Every recovery route below assumes you are the one walking it.',
        remediation: 'Add a successor role and describe what they can reach and when.',
        subjects: [{ type: 'plan', id: plan.id }],
      })
    )
  }

  for (const person of plan.people) {
    if (person.role !== 'cosigner') continue
    if (plan.keys.some((key) => key.heldBy === person.id)) continue
    add(
      makeFinding(plan, {
        rule: 'S017',
        key: person.id,
        title: `${person.label} is a co-signer who signs nothing`,
        detail:
          'The role implies the plan depends on them, and no key is assigned to them, so it does not.',
        remediation: `Assign a key to ${person.label}, or change their role to match what they actually do.`,
        subjects: [{ type: 'person', id: person.id }],
      })
    )
  }

  if (plan.locations.length > 1) {
    const ungrouped = plan.locations.filter((location) => location.disasterGroup === null)
    if (ungrouped.length > 0) {
      add(
        makeFinding(plan, {
          rule: 'S018',
          key: 'ungrouped',
          title: `${ungrouped.length} ${ungrouped.length === 1 ? 'location has' : 'locations have'} no disaster group`,
          detail: `${list(ungrouped.map((location) => location.label))} ${ungrouped.length === 1 ? 'is' : 'are'} assumed to fail independently of everything else, because nothing says otherwise.`,
          remediation:
            'Give each location a group naming what it would fail with: a building, a city, a flood plain, a jurisdiction.',
          subjects: ungrouped.map((location) => ({ type: 'location' as const, id: location.id })),
        })
      )
    }
  }

  return findings
}
