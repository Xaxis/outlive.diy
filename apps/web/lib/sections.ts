import type { EntityKind } from './store.ts'

export type Section = 'profile' | 'locations' | 'people' | 'devices' | 'keys' | 'wallets' | 'checks'

export interface SectionDefinition {
  id: Section
  /** Plural, as it appears on the tab. */
  label: string
  /** Singular, as it appears above one of them in the inspector. */
  singular: string
  kind: EntityKind | null
  blurb: string
}

/**
 * The order of these is an argument.
 *
 * Places come before everything except purpose, because every other part of a
 * custody plan is a statement about where something is, and people who start
 * with devices end up describing a shopping list rather than a plan.
 */
export const SECTIONS: SectionDefinition[] = [
  {
    id: 'profile',
    label: 'Purpose',
    singular: 'Purpose',
    kind: null,
    blurb: 'What this plan is for, and how much disruption you can absorb.',
  },
  {
    id: 'locations',
    label: 'Places',
    singular: 'Place',
    kind: 'location',
    blurb:
      'Every other part of a custody plan is a statement about where something is, so places come first. Give each one a role label and say what it would fail together with.',
  },
  {
    id: 'people',
    label: 'People',
    singular: 'Person',
    kind: 'person',
    blurb:
      'Roles, never names. Who could act if you could not, and the other question: who could act while you still can.',
  },
  {
    id: 'devices',
    label: 'Devices',
    singular: 'Device',
    kind: 'device',
    blurb:
      'What signs. The maker matters structurally even when the model does not, because two keys behind one maker are one decision.',
  },
  {
    id: 'keys',
    label: 'Keys',
    singular: 'Key',
    kind: 'key',
    blurb:
      'One signing key, the device it lives on, and everything it can be rebuilt from. Those three are independent, and the plan is mostly about how independent.',
  },
  {
    id: 'wallets',
    label: 'Wallets',
    singular: 'Wallet',
    kind: 'wallet',
    blurb:
      'Thresholds over keys. For anything multisig, also where the descriptor lives, without which a threshold of seeds restores nothing.',
  },
  {
    id: 'checks',
    label: 'Checks',
    singular: 'Check',
    kind: 'verification',
    blurb:
      'What has been proved rather than assumed, and when it was last true. This is the section that decides whether the rest is worth anything.',
  },
]
