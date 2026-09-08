/**
 * Worked examples.
 *
 * These are teaching objects. Each one is a plan somebody plausibly has, and
 * each one produces findings that are worth reading, including the first one,
 * which is deliberately the setup most people actually start from. Nothing here
 * is presented as a recommendation: the second example is better than the
 * first, and the analysis says why, which is a different thing from the app
 * having an opinion about what the user should build.
 *
 * Ids are fixed rather than generated so that tests, and the draft comparison,
 * can refer to the same objects across two plans.
 */

import type { Plan } from './types.ts'
import { SCHEMA_VERSION } from './types.ts'
import {
  createBackup,
  createConfigBackup,
  createDevice,
  createKey,
  createLocation,
  createPerson,
  createPlan,
  createSpendPath,
  createVerification,
  createWallet,
} from './factory.ts'

export interface Example {
  id: string
  name: string
  /** One line, shown on the card. */
  summary: string
  /** What this example is for, shown when it is opened. */
  teaches: string
  build: () => Plan
}

const DATE = '2026-01-15'

function base(overrides: Partial<Plan>): Plan {
  return createPlan({
    createdAt: DATE,
    updatedAt: DATE,
    schemaVersion: SCHEMA_VERSION,
    ...overrides,
  })
}

// --- 1. where almost everybody starts ---------------------------------------

function oneSigner(): Plan {
  return base({
    id: 'example-one-signer',
    name: 'One signer, one backup',
    profile: {
      concerns: ['loss', 'theft', 'fire-flood', 'death'],
      recoveryToleranceDays: 7,
      horizonYears: 30,
      jurisdictionCount: 1,
      travelsFrequently: false,
    },
    locations: [
      createLocation({
        id: 'loc_home',
        label: 'Site A',
        kind: 'home',
        travelMinutes: 0,
        disasterGroup: 'The flat',
        notes: 'Where I live. Everything is here.',
      }),
    ],
    devices: [
      createDevice({
        id: 'dev_signer',
        label: 'Signer A',
        kind: 'hardware-signer',
        vendor: 'Vendor One',
        pin: { storage: 'memorized', locationId: null, knownBy: [] },
        supplyChain: 'direct-from-vendor',
      }),
    ],
    keys: [
      createKey({
        id: 'key_a',
        label: 'Key A',
        deviceId: 'dev_signer',
        deviceLocationId: 'loc_home',
        backups: [
          createBackup({
            id: 'bak_a1',
            label: 'Steel plate',
            medium: 'steel',
            locationId: 'loc_home',
          }),
        ],
      }),
    ],
    wallets: [
      createWallet({
        id: 'wal_savings',
        label: 'Savings',
        tier: 'vault',
        stake: 'large',
        paths: [
          createSpendPath({
            id: 'path_savings',
            label: 'Everyday',
            kind: 'primary',
            threshold: 1,
            keyIds: ['key_a'],
          }),
        ],
      }),
    ],
  })
}

// --- 2. the usual next step, with the usual flaws ---------------------------

function twoOfThree(): Plan {
  return base({
    id: 'example-two-of-three',
    name: 'Two of three, three sites',
    profile: {
      concerns: ['loss', 'theft', 'fire-flood', 'death', 'coercion'],
      recoveryToleranceDays: 30,
      horizonYears: 30,
      jurisdictionCount: 1,
      travelsFrequently: false,
    },
    locations: [
      createLocation({
        id: 'loc_home',
        label: 'Site A',
        kind: 'home',
        travelMinutes: 0,
        disasterGroup: 'Home city',
      }),
      createLocation({
        id: 'loc_bank',
        label: 'Site B',
        kind: 'bank-vault',
        travelMinutes: 40,
        // Deliberately the same group as Site A. It reads like separation and
        // is not: one flood, one earthquake, one jurisdiction.
        disasterGroup: 'Home city',
        requiresUserPresence: true,
        tamperEvident: true,
      }),
      createLocation({
        id: 'loc_family',
        label: 'Site C',
        kind: 'trusted-person',
        travelMinutes: 320,
        disasterGroup: 'Coast',
        custodianId: 'per_successor',
        access: [{ personId: 'per_successor', condition: 'after-death', delayDays: 60 }],
      }),
    ],
    people: [
      createPerson({
        id: 'per_successor',
        label: 'Successor 1',
        role: 'successor',
        technicalSkill: 'basic',
        knowsPlanExists: true,
        knowsWhereInstructionsAre: false,
        availability: 'days',
      }),
    ],
    devices: [
      createDevice({
        id: 'dev_one',
        label: 'Signer A',
        vendor: 'Vendor One',
        architecture: 'Secure element A',
        supplyChain: 'direct-from-vendor',
      }),
      createDevice({
        id: 'dev_two',
        label: 'Signer B',
        vendor: 'Vendor One',
        architecture: 'Secure element A',
        supplyChain: 'direct-from-vendor',
      }),
      createDevice({
        id: 'dev_three',
        label: 'Signer C',
        vendor: 'Vendor Two',
        architecture: 'General purpose B',
        airGapped: true,
        supplyChain: 'reseller',
      }),
    ],
    keys: [
      createKey({
        id: 'key_a',
        label: 'Key A',
        deviceId: 'dev_one',
        deviceLocationId: 'loc_home',
        backups: [
          createBackup({
            id: 'bak_a',
            label: 'Steel plate',
            medium: 'steel',
            locationId: 'loc_home',
          }),
        ],
      }),
      createKey({
        id: 'key_b',
        label: 'Key B',
        deviceId: 'dev_two',
        deviceLocationId: 'loc_home',
        backups: [
          createBackup({
            id: 'bak_b',
            label: 'Steel plate',
            medium: 'steel',
            locationId: 'loc_bank',
          }),
        ],
      }),
      createKey({
        id: 'key_c',
        label: 'Key C',
        deviceId: 'dev_three',
        deviceLocationId: 'loc_family',
        backups: [
          createBackup({
            id: 'bak_c',
            label: 'Steel plate',
            medium: 'steel',
            locationId: 'loc_family',
          }),
        ],
      }),
    ],
    wallets: [
      createWallet({
        id: 'wal_vault',
        label: 'Vault',
        tier: 'vault',
        stake: 'large',
        paths: [
          createSpendPath({
            id: 'path_vault',
            label: 'Everyday',
            kind: 'primary',
            threshold: 2,
            keyIds: ['key_a', 'key_b', 'key_c'],
          }),
        ],
        configBackups: [
          createConfigBackup({ id: 'cfg_a', label: 'Printed descriptor', locationId: 'loc_home' }),
        ],
      }),
      createWallet({
        id: 'wal_daily',
        label: 'Daily',
        tier: 'hot',
        stake: 'small',
        paths: [
          createSpendPath({
            id: 'path_daily',
            label: 'Phone',
            kind: 'primary',
            threshold: 1,
            keyIds: ['key_a'],
          }),
        ],
      }),
    ],
    verifications: [
      createVerification({
        id: 'ver_restore_a',
        kind: 'backup-restore',
        subject: { type: 'key', id: 'key_a' },
        lastVerifiedAt: '2025-02-01',
        intervalDays: 365,
      }),
      createVerification({
        id: 'ver_spend_vault',
        kind: 'spend-test',
        subject: { type: 'wallet', id: 'wal_vault' },
        lastVerifiedAt: '2025-11-20',
        intervalDays: 180,
      }),
    ],
  })
}

// --- 3. the same plan, repaired ---------------------------------------------

function twoOfThreeRepaired(): Plan {
  const plan = twoOfThree()
  return {
    ...plan,
    id: 'example-two-of-three-draft',
    name: 'Two of three, repaired',
    kind: 'draft',
    locations: plan.locations.map((location) =>
      location.id === 'loc_bank'
        ? { ...location, disasterGroup: 'Second city', travelMinutes: 190 }
        : location
    ),
    devices: plan.devices.map((device) =>
      device.id === 'dev_two'
        ? {
            ...device,
            vendor: 'Vendor Three',
            architecture: 'Secure element C',
            supplyChain: 'direct-from-vendor' as const,
          }
        : device
    ),
    keys: plan.keys.map((key) =>
      key.id === 'key_b' ? { ...key, deviceLocationId: 'loc_bank' } : key
    ),
    people: plan.people.map((person) =>
      person.id === 'per_successor'
        ? { ...person, knowsWhereInstructionsAre: true, technicalSkill: 'competent' as const }
        : person
    ),
    wallets: plan.wallets.map((wallet) =>
      wallet.id === 'wal_vault'
        ? {
            ...wallet,
            paths: [
              ...wallet.paths,
              createSpendPath({
                id: 'path_inherit',
                label: 'Inheritance',
                kind: 'inheritance',
                threshold: 1,
                keyIds: ['key_c'],
                timelockDays: 180,
              }),
            ],
            configBackups: [
              ...wallet.configBackups,
              createConfigBackup({
                id: 'cfg_c',
                label: 'Printed descriptor',
                locationId: 'loc_family',
              }),
            ],
          }
        : wallet
    ),
    verifications: [
      ...plan.verifications,
      createVerification({
        id: 'ver_dry_run',
        kind: 'successor-dry-run',
        subject: { type: 'person', id: 'per_successor' },
        lastVerifiedAt: '2025-12-05',
        intervalDays: 730,
      }),
      createVerification({
        id: 'ver_config',
        kind: 'config-backup-restore',
        subject: { type: 'wallet', id: 'wal_vault' },
        lastVerifiedAt: '2025-12-05',
        intervalDays: 365,
      }),
    ],
  }
}

export const EXAMPLES: Example[] = [
  {
    id: 'one-signer',
    name: 'One signer, one backup',
    summary: 'A single hardware wallet and a steel plate, both at home.',
    teaches:
      'The setup most people actually have. It survives a device failure and nothing else: one burglary or one fire is the end of it, and nobody can recover it after you.',
    build: oneSigner,
  },
  {
    id: 'two-of-three',
    name: 'Two of three, three sites',
    summary: 'A 2-of-3 multisig with keys spread across a home, a bank and a relative.',
    teaches:
      'The standard answer, with the flaws it usually ships with: two of the three sites in one city, two of the three signers from one vendor, one copy of the wallet configuration, and a successor who has not been told where to start.',
    build: twoOfThree,
  },
  {
    id: 'two-of-three-repaired',
    name: 'Two of three, repaired',
    summary: 'The same plan with the concentration removed and an inheritance path added.',
    teaches:
      'What the findings from the previous example look like once they are acted on. Open both and compare them to see which findings the changes actually close.',
    build: twoOfThreeRepaired,
  },
]

export function exampleById(id: string): Plan | null {
  const example = EXAMPLES.find((entry) => entry.id === id)
  return example ? example.build() : null
}
