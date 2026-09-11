import type { Plan } from '@outlive/core'
import type { EntityKind } from './store.ts'

export type Section = 'profile' | 'locations' | 'people' | 'devices' | 'keys' | 'wallets' | 'checks'

export interface SectionDefinition {
  id: Section
  /** Plural, as it appears on the step. */
  label: string
  /** Singular, as it appears above one of them in the inspector. */
  singular: string
  kind: EntityKind | null
  /**
   * Why this step exists, read before the fields rather than after them.
   *
   * There used to be two of these per section: one for the design screens and
   * one for the guided route, which were two shells around the same editors.
   * They drifted, as two descriptions of one thing do. There is one now.
   */
  purpose: string
  /** Whether this has been answered, for the tick on the step. */
  done: (plan: Plan) => boolean
  /**
   * A step that is legitimately skippable. It never shows a tick, because a
   * tick against something nobody did is the rail telling a small lie.
   */
  optional?: boolean
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
    purpose:
      'None of this suppresses a finding. It decides which ones you read first, because a list that treats every risk as equally urgent is a list nobody finishes.',
    done: (plan) => plan.profile.concerns.length > 0,
  },
  {
    id: 'locations',
    label: 'Places',
    singular: 'Place',
    kind: 'location',
    purpose:
      'Give each place a role label and, more importantly, say what it would fail together with. Two sites in one flood plain are one site as far as fire and flood are concerned.',
    done: (plan) => plan.locations.length > 0,
  },
  {
    id: 'people',
    label: 'People',
    singular: 'Person',
    kind: 'person',
    purpose:
      'Roles, never names. Who could act if you could not, and the other question: who could act while you still can. This is the step most people skip and later regret.',
    done: (plan) => plan.people.length > 0,
    optional: true,
  },
  {
    id: 'devices',
    label: 'Devices',
    singular: 'Device',
    kind: 'device',
    purpose:
      'What signs. The maker matters structurally even when the model does not, because two keys behind one maker are one decision. A key that exists only as a written backup needs no device here.',
    done: (plan) => plan.devices.length > 0 || plan.keys.length > 0,
  },
  {
    id: 'keys',
    label: 'Keys',
    singular: 'Key',
    kind: 'key',
    purpose:
      'One signing key, the device it lives on, and separately everything it can be rebuilt from. Those last two being in the same place is the single most common flaw this program finds.',
    done: (plan) => plan.keys.length > 0,
  },
  {
    id: 'wallets',
    label: 'Wallets',
    singular: 'Wallet',
    kind: 'wallet',
    purpose:
      'A threshold over keys. For anything multisig, say where the descriptor lives too: a threshold of seeds without it restores nothing.',
    done: (plan) => plan.wallets.length > 0,
  },
  {
    id: 'checks',
    label: 'Checks',
    singular: 'Check',
    kind: 'verification',
    purpose:
      'What has been proved rather than assumed, and when it was last true. This is the section that decides whether the rest is worth anything.',
    done: (plan) => plan.verifications.length > 0,
  },
]
