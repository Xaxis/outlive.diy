/**
 * Compromise: take one thing and ask whether an attacker can spend.
 *
 * The asymmetry with loss is the whole point. Recovery needs the threshold and
 * so does theft, but they do not need the same objects. A written backup is a
 * key in an attacker's hands. A PIN-locked device is not, until they also have
 * the person who knows the PIN, which is what the coercion analysis is for.
 */

import type { Finding } from './findings.ts'
import { escalate, makeFinding, walletWeight } from './findings.ts'
import type { AnalysisContext } from './context.ts'
import { evaluateWallet } from './availability.ts'
import { locationCompromisedScenario, personCompromisedScenario } from './scenarios.ts'
import { devicesByVendor, isMultisig, walletKeyIds } from '../model/selectors.ts'
import type { Id, Plan, Wallet } from '../model/types.ts'

function names(items: readonly string[]): string {
  if (items.length === 0) return 'nothing'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * Whether a set of keys is by itself enough to spend a wallet, ignoring where
 * anything is. Used for the failures that hand over key material directly:
 * a vendor backdoor, a file on a disk.
 */
function keysetSpends(
  wallet: Wallet,
  keyIds: ReadonlySet<Id>
): { yes: boolean; pathLabel: string } {
  for (const path of wallet.paths) {
    if (path.timelockDays > 0) continue
    const held = path.keyIds.filter((id) => keyIds.has(id)).length
    if (held >= path.threshold) return { yes: true, pathLabel: path.label }
  }
  return { yes: false, pathLabel: '' }
}

/** Every wallet an attacker can spend in this world. */
function exposed(ctx: AnalysisContext, world: Parameters<typeof evaluateWallet>[2]): Wallet[] {
  return ctx.plan.wallets.filter((wallet) => evaluateWallet(ctx.plan, wallet, world).spendable)
}

export interface CompromiseResult {
  findings: Finding[]
  /** People already reported as able to spend, so other rules do not repeat it. */
  spendingPeople: Set<Id>
}

export function analyseCompromise(ctx: AnalysisContext): CompromiseResult {
  const { plan } = ctx
  const findings: Finding[] = []
  const spendingPeople = new Set<Id>()
  const worst = (wallets: readonly Wallet[]) =>
    Math.max(0, ...wallets.map((wallet) => walletWeight(wallet)))

  // --- one place ------------------------------------------------------------
  for (const location of plan.locations) {
    const scenario = locationCompromisedScenario(ctx, location.id)
    const hit = exposed(ctx, scenario.world).filter((wallet) => !wallet.decoy)
    if (hit.length === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'C001',
        key: location.id,
        title: `${location.label} alone is enough to spend ${names(hit.map((w) => w.label))}`,
        detail: `Everything needed to reach a threshold on ${names(hit.map((w) => w.label))} is inside ${location.label}. Whoever opens that container ends the matter, without needing you, any other place, or anything you remember.`,
        remediation: `Move key material out of ${location.label} until what remains there is below the threshold of every wallet, or add a passphrase kept somewhere else entirely.`,
        subjects: [
          { type: 'location', id: location.id },
          ...hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        ],
        world: scenario.label,
        severity: escalate('critical', worst(hit)),
      })
    )
  }

  // --- one person -----------------------------------------------------------
  // Successors are handled by the succession analysis, which frames the same
  // fact as the inheritance problem it actually is.
  for (const person of plan.people) {
    const scenario = personCompromisedScenario(ctx, person.id)
    const hit = exposed(ctx, scenario.world).filter((wallet) => !wallet.decoy)
    if (hit.length === 0) continue
    spendingPeople.add(person.id)
    if (person.role === 'successor' || person.role === 'executor') continue
    findings.push(
      makeFinding(plan, {
        rule: 'C002',
        key: person.id,
        title: `${person.label} can spend ${names(hit.map((w) => w.label))} alone`,
        detail: `${person.label} can reach enough key material without you, today, and without anybody noticing. Access granted for a recovery that may never happen is access available every day until then.`,
        remediation: `Reduce what ${person.label} can reach below the threshold, or make their access conditional rather than standing.`,
        subjects: [
          { type: 'person', id: person.id },
          ...hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        ],
        world: scenario.label,
        severity: escalate('critical', worst(hit)),
      })
    )
  }

  // --- one vendor -----------------------------------------------------------
  // A vendor failure hands over the key itself: a backdoor, a weak random
  // number generator, a substituted device. Location does not help.
  for (const [vendorKey, devices] of devicesByVendor(plan)) {
    const vendorName = devices[0].vendor ?? vendorKey
    const keyIds = new Set(
      plan.keys.filter((key) => devices.some((d) => d.id === key.deviceId)).map((key) => key.id)
    )
    if (keyIds.size === 0) continue
    const hit = plan.wallets.filter((wallet) => !wallet.decoy && keysetSpends(wallet, keyIds).yes)
    if (hit.length === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'C003',
        key: vendorKey,
        title: `A failure at ${vendorName} alone is enough to spend ${names(hit.map((w) => w.label))}`,
        detail: `${keyIds.size} of the keys in this plan were generated on ${vendorName} hardware, which is a threshold on ${names(hit.map((w) => w.label))}. A backdoor, a weak random number generator, or an interception in that one supply line takes the wallet regardless of where anything is stored.`,
        remediation: `Replace enough of the ${vendorName} keys with a different vendor that no single maker covers a threshold.`,
        subjects: [
          ...devices.map((device) => ({ type: 'device' as const, id: device.id })),
          ...hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
        ],
        severity: escalate('high', worst(hit)),
      })
    )
  }

  // --- key material in files ------------------------------------------------
  const digitalKeyIds = new Set(
    plan.keys
      .filter((key) => key.backups.some((backup) => backup.medium === 'plain-digital'))
      .map((key) => key.id)
  )
  if (digitalKeyIds.size > 0) {
    const hit = plan.wallets.filter(
      (wallet) => !wallet.decoy && keysetSpends(wallet, digitalKeyIds).yes
    )
    if (hit.length > 0) {
      findings.push(
        makeFinding(plan, {
          rule: 'C004',
          key: 'plain-digital',
          title: `Unencrypted files hold enough to spend ${names(hit.map((w) => w.label))}`,
          detail: `${digitalKeyIds.size} ${digitalKeyIds.size === 1 ? 'key exists' : 'keys exist'} in plain digital form, which is a threshold on ${names(hit.map((w) => w.label))}. Files are copied by sync clients, backup software, disk images and anything that has ever had read access, and every copy is silent.`,
          remediation:
            'Treat those keys as already compromised. Build fresh keys, move the coins, and then destroy the files and their backups.',
          subjects: [
            ...[...digitalKeyIds].map((id) => ({ type: 'key' as const, id })),
            ...hit.map((wallet) => ({ type: 'wallet' as const, id: wallet.id })),
          ],
          severity: escalate('high', worst(hit)),
        })
      )
    }
  }

  // --- unlocked devices where others walk ------------------------------------
  for (const device of plan.devices) {
    if (device.pin.storage !== 'none') continue
    const keys = plan.keys.filter((key) => key.deviceId === device.id)
    const places = new Set(keys.map((key) => key.deviceLocationId).filter((id): id is Id => !!id))
    const shared = plan.locations.filter(
      (location) => places.has(location.id) && location.access.length > 0
    )
    if (shared.length === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'C005',
        key: device.id,
        title: `${device.label} has no PIN and sits where others can reach it`,
        detail: `${device.label} is kept at ${names(shared.map((location) => location.label))}, where ${names(
          shared.flatMap((location) =>
            location.access.map(
              (access) => ctx.index.people.get(access.personId)?.label ?? 'someone'
            )
          )
        )} can also go. Without a PIN, holding the device is enough to sign with it.`,
        remediation: `Set a PIN on ${device.label}.`,
        subjects: [{ type: 'device', id: device.id }],
      })
    )
  }

  // --- a descriptor somebody else can read ------------------------------------
  //
  // The reason it is safe to copy is the reason it is worth thinking about
  // where the copies go: it cannot spend, and it can be watched.
  for (const wallet of plan.wallets) {
    if (wallet.decoy || !isMultisig(wallet)) continue
    const readers = new Map<Id, string>()
    for (const backup of wallet.configBackups) {
      if (backup.locationId === null) continue
      const location = ctx.index.locations.get(backup.locationId)
      if (!location) continue
      if (location.custodianId) {
        readers.set(
          location.custodianId,
          ctx.index.people.get(location.custodianId)?.label ?? 'someone'
        )
      }
      for (const access of location.access) {
        if (access.condition !== 'always') continue
        readers.set(access.personId, ctx.index.people.get(access.personId)?.label ?? 'someone')
      }
    }
    if (readers.size === 0) continue
    findings.push(
      makeFinding(plan, {
        rule: 'C007',
        key: wallet.id,
        title: `${names([...readers.values()])} can read ${wallet.label}'s configuration`,
        detail: `A copy of ${wallet.label}'s descriptor sits where ${names([...readers.values()])} can reach it today. It cannot spend, which is why it is safe to have copies at all, and it does show every address the wallet will ever use and every balance it has ever held, permanently and without needing to ask again.`,
        remediation: `Either keep ${wallet.label}'s configuration only where its keys are, or decide deliberately that ${names([...readers.values()])} may watch the balance, and record that you decided it.`,
        subjects: [
          { type: 'wallet', id: wallet.id },
          ...[...readers.keys()].map((id) => ({ type: 'person' as const, id })),
        ],
      })
    )
  }

  // --- passphrases that buy nothing ------------------------------------------
  const passphraseFinding = analysePassphraseValue(ctx)
  if (passphraseFinding) findings.push(passphraseFinding)

  return { findings, spendingPeople }
}

/**
 * Whether the plan's passphrases change any compromise outcome at all.
 *
 * The test is blunt and that is the value of it: run every adversary scenario
 * twice, once as described and once with every passphrase switched off. If the
 * two runs agree everywhere, the passphrases are costing the user a memorised
 * secret and an extra recovery step in exchange for nothing.
 */
function analysePassphraseValue(ctx: AnalysisContext): Finding | null {
  const { plan } = ctx
  const withPassphrase = plan.keys.filter((key) => key.passphrase.enabled)
  if (withPassphrase.length === 0) return null

  const stripped: Plan = {
    ...plan,
    keys: plan.keys.map((key) => ({
      ...key,
      passphrase: { ...key.passphrase, enabled: false },
    })),
  }

  const scenarios = [
    ...plan.locations.map((location) => locationCompromisedScenario(ctx, location.id)),
    ...plan.people.map((person) => personCompromisedScenario(ctx, person.id)),
  ]
  if (scenarios.length === 0) return null

  let anyDifference = false
  let anyExposure = false
  for (const scenario of scenarios) {
    for (const wallet of plan.wallets) {
      const asIs = evaluateWallet(plan, wallet, scenario.world).spendable
      const without = evaluateWallet(stripped, wallet, scenario.world).spendable
      if (asIs) anyExposure = true
      if (asIs !== without) anyDifference = true
    }
  }
  if (anyDifference || !anyExposure) return null

  return makeFinding(plan, {
    rule: 'C006',
    key: 'passphrase-value',
    title: 'The passphrases in this plan do not change any outcome',
    detail: `${withPassphrase.length} ${withPassphrase.length === 1 ? 'key uses' : 'keys use'} a passphrase, and switching every one of them off changes nothing about who can spend what. Wherever a quorum is exposed, the passphrase is exposed with it, so it is buying an extra secret to remember and an extra way for recovery to fail, in exchange for no additional barrier.`,
    remediation:
      'Move the passphrases to a location that holds none of the seeds they protect, or drop them and rely on the threshold instead.',
    subjects: withPassphrase.map((key) => ({ type: 'key' as const, id: key.id })),
  })
}

export { keysetSpends, walletKeyIds }
