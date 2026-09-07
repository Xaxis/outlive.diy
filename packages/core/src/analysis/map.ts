/**
 * The map: keys against locations, and where quorum concentrates.
 *
 * This is the one view that has to be readable without reading anything. The
 * arithmetic is deliberately simple, and it is the same arithmetic the
 * compromise analysis uses, so that a column the map colours red is a column
 * the findings list has an entry for.
 */

import type { Id, Plan } from '../model/types.ts'
import { evaluateWallet } from './availability.ts'
import { locationCompromisedScenario } from './scenarios.ts'
import type { AnalysisContext } from './context.ts'

export type Holding = 'device' | 'backup' | 'split-share' | 'passphrase' | 'pin' | 'config'

export interface MapCell {
  keyId: Id
  locationId: Id
  holds: Holding[]
}

export interface WalletQuorum {
  walletId: Id
  /** Keys of this wallet whose material is present at the location. */
  present: number
  /** The lowest threshold among paths usable today. */
  threshold: number
  /** Whether an attacker who opened only this location could actually spend. */
  spendable: boolean
}

export interface MapColumn {
  locationId: Id
  keyIds: Id[]
  /** Wallet configuration copies kept here. */
  configWalletIds: Id[]
  quorum: WalletQuorum[]
  /** True when opening this one place is enough to spend a real wallet. */
  concentratesQuorum: boolean
}

export interface QuorumMap {
  keyIds: Id[]
  locationIds: Id[]
  cells: MapCell[]
  columns: MapColumn[]
  /** Key material with no recorded place, which the map cannot show. */
  unplacedKeyIds: Id[]
}

export function buildMap(ctx: AnalysisContext): QuorumMap {
  const { plan } = ctx
  const cells: MapCell[] = []
  const unplaced = new Set<Id>()

  const push = (keyId: Id, locationId: Id | null, holding: Holding) => {
    if (locationId === null) {
      unplaced.add(keyId)
      return
    }
    const existing = cells.find((cell) => cell.keyId === keyId && cell.locationId === locationId)
    if (existing) {
      if (!existing.holds.includes(holding)) existing.holds.push(holding)
      return
    }
    cells.push({ keyId, locationId, holds: [holding] })
  }

  for (const key of plan.keys) {
    if (key.deviceId) push(key.id, key.deviceLocationId, 'device')
    for (const backup of key.backups) {
      if (backup.medium === 'memorized') continue
      push(key.id, backup.locationId, backup.split ? 'split-share' : 'backup')
    }
    if (key.passphrase.enabled && key.passphrase.storage !== 'memorized') {
      for (const locationId of key.passphrase.locationIds) push(key.id, locationId, 'passphrase')
    }
    const device = key.deviceId ? ctx.index.devices.get(key.deviceId) : undefined
    if (device?.pin.storage === 'written') push(key.id, device.pin.locationId, 'pin')
  }

  const columns: MapColumn[] = plan.locations.map((location) => {
    const scenario = locationCompromisedScenario(ctx, location.id)
    const keyIds = cells.filter((cell) => cell.locationId === location.id).map((cell) => cell.keyId)

    const quorum: WalletQuorum[] = plan.wallets.map((wallet) => {
      const usable = wallet.paths.filter((path) => path.timelockDays === 0)
      const threshold = usable.length ? Math.min(...usable.map((path) => path.threshold)) : 0
      const present = new Set(
        usable.flatMap((path) => path.keyIds.filter((keyId) => keyIds.includes(keyId)))
      ).size
      return {
        walletId: wallet.id,
        present,
        threshold,
        spendable: evaluateWallet(plan, wallet, scenario.world).spendable,
      }
    })

    return {
      locationId: location.id,
      keyIds: [...new Set(keyIds)],
      configWalletIds: plan.wallets
        .filter((wallet) =>
          wallet.configBackups.some((backup) => backup.locationId === location.id)
        )
        .map((wallet) => wallet.id),
      quorum,
      concentratesQuorum: quorum.some(
        (entry) => entry.spendable && !plan.wallets.find((w) => w.id === entry.walletId)?.decoy
      ),
    }
  })

  return {
    keyIds: plan.keys.map((key) => key.id),
    locationIds: plan.locations.map((location) => location.id),
    cells,
    columns,
    unplacedKeyIds: [...unplaced],
  }
}

/** Keys whose material appears at more than one place, for the map's link lines. */
export function spreadOfKey(map: QuorumMap, keyId: Id): Id[] {
  return map.cells.filter((cell) => cell.keyId === keyId).map((cell) => cell.locationId)
}

export function planIsEmpty(plan: Plan): boolean {
  return (
    plan.keys.length === 0 &&
    plan.wallets.length === 0 &&
    plan.locations.length === 0 &&
    plan.people.length === 0
  )
}
