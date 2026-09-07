/**
 * The words the interface uses for the model's values.
 *
 * One place, so that a backup medium is called the same thing in the editor, on
 * the map, in the runbook and in a finding. Where a label needs a caveat, the
 * caveat lives here too rather than being retyped into each screen.
 */

import type {
  AccessCondition,
  BackupMedium,
  Concern,
  DeviceKind,
  LocationKind,
  PersonRole,
  Plan,
  SpendPathKind,
  Stake,
  SupplyChain,
  TechnicalSkill,
  VerificationKind,
  Wallet,
  WalletTier,
} from '@outlive/core'

export const LOCATION_KIND: Record<LocationKind, string> = {
  home: 'Home',
  'second-home': 'Second home',
  workplace: 'Workplace',
  'bank-vault': 'Bank safe deposit',
  'private-vault': 'Private vault',
  'trusted-person': "Another person's place",
  concealed: 'Concealed or buried',
  'on-person': 'On your person',
  other: 'Somewhere else',
}

export const DEVICE_KIND: Record<DeviceKind, string> = {
  'hardware-signer': 'Hardware signer',
  'air-gapped-signer': 'Air-gapped signer',
  'mobile-wallet': 'Phone wallet',
  'desktop-wallet': 'Desktop wallet',
  'paper-only': 'No device, paper only',
  'service-cosigner': 'Service co-signer',
  other: 'Something else',
}

export const BACKUP_MEDIUM: Record<BackupMedium, string> = {
  steel: 'Steel or titanium',
  paper: 'Paper',
  'encrypted-digital': 'Encrypted file',
  'plain-digital': 'Unencrypted file',
  memorized: 'Memorised',
}

export const BACKUP_MEDIUM_NOTE: Record<BackupMedium, string> = {
  steel: 'Survives fire, water and time. The default for anything you intend to keep.',
  paper: 'Fine for a short-lived key. Loses to fire, water and thirty years of humidity.',
  'encrypted-digital':
    'Inert without its password, which nobody else has. Poor for inheritance, for exactly that reason.',
  'plain-digital':
    'Copied silently by everything. Treat any key in this form as already compromised.',
  memorized: 'Not in a place at all. Dies with the memory that holds it.',
}

export const PERSON_ROLE: Record<PersonRole, string> = {
  cosigner: 'Co-signer',
  successor: 'Successor',
  executor: 'Executor',
  'key-agent': 'Key agent or service',
  aware: 'Knows it exists',
  professional: 'Professional (lawyer, accountant)',
}

export const SKILL: Record<TechnicalSkill, string> = {
  none: 'None',
  basic: 'Can follow written steps',
  competent: 'Comfortable with wallets',
  expert: 'Expert',
}

export const ACCESS_CONDITION: Record<AccessCondition, string> = {
  always: 'Any time, without you',
  'with-user': 'Only alongside you',
  'after-death': 'Only after your death',
}

export const TIER: Record<WalletTier, string> = {
  hot: 'Hot',
  active: 'Active',
  vault: 'Vault',
}

export const TIER_NOTE: Record<WalletTier, string> = {
  hot: 'On a networked device. Exposed to everything that device is exposed to.',
  active: 'Used regularly, but signed from a dedicated device.',
  vault: 'Long-term storage. Touched rarely and deliberately.',
}

export const STAKE: Record<Stake, string> = {
  small: 'A small share',
  moderate: 'A meaningful share',
  large: 'Most of it',
}

export const SUPPLY_CHAIN: Record<SupplyChain, string> = {
  'direct-from-vendor': 'Direct from the maker',
  reseller: 'A reseller',
  'second-hand': 'Second hand',
  unknown: 'Not recorded',
}

export const PATH_KIND: Record<SpendPathKind, string> = {
  primary: 'Everyday',
  recovery: 'Recovery',
  inheritance: 'Inheritance',
}

export const CONCERN: Record<Concern, string> = {
  loss: 'Losing access myself',
  theft: 'Theft',
  coercion: 'Being compelled in person',
  'fire-flood': 'Fire, flood, disaster',
  death: 'My death',
  incapacity: 'Losing capacity',
  'legal-seizure': 'Legal seizure',
  insider: 'Someone close to me',
  'supply-chain': 'Tampered hardware',
}

export const VERIFICATION_KIND: Record<VerificationKind, string> = {
  'backup-restore': 'Restore a backup and check it matches',
  'config-backup-restore': 'Rebuild the wallet from its written configuration',
  'spend-test': 'Send a small amount out',
  'recovery-drill': 'Walk a full recovery',
  'successor-dry-run': 'Watch a successor attempt it',
  'location-access': 'Open a location and check what is in it',
  'device-firmware': 'Power a device on and check it',
  'passphrase-recall': 'Recall a passphrase from memory',
  'inventory-check': 'Count everything against the plan',
}

/** "2-of-3", or "2-of-3, plus 1-of-1 after 180 days". */
export function describePolicy(wallet: Wallet): string {
  if (wallet.paths.length === 0) return 'no way to spend'
  const parts = wallet.paths.map((path) => {
    const shape = `${path.threshold}-of-${path.keyIds.length}`
    return path.timelockDays > 0 ? `${shape} after ${path.timelockDays} days` : shape
  })
  return parts.join(', then ')
}

export function describeTravel(minutes: number | null): string {
  if (minutes === null) return 'unknown distance'
  if (minutes === 0) return 'here'
  if (minutes < 60) return `${minutes} min away`
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0 ? `${hours}h away` : `${hours}h ${rest}m away`
  }
  const days = Math.round(minutes / (24 * 60))
  return `${days} ${days === 1 ? 'day' : 'days'} away`
}

/** "3 keys", "1 key". Counting things is not worth a mistake. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

export function planIsStarted(plan: Plan): boolean {
  return (
    plan.locations.length > 0 ||
    plan.keys.length > 0 ||
    plan.wallets.length > 0 ||
    plan.people.length > 0
  )
}
