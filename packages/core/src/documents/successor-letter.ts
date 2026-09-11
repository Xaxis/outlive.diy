/**
 * The successor letter.
 *
 * This document is printed, put in an envelope, and read by somebody who has
 * just lost the person who wrote it. It contains no secret, no location, and no
 * instruction that only makes sense to its author. Everything in it is either
 * a sentence the reader needs in the first hour, or a warning about the
 * mistakes that are made in that hour.
 *
 * The tone is deliberate. It is addressed to one person, it does not assume
 * they know anything about Bitcoin, and it does not congratulate anybody.
 */

import type { Person, Plan } from '../model/types.ts'
import type { AnalysisContext } from '../analysis/context.ts'
import { isMultisig } from '../model/selectors.ts'
import { requiredSkill, successionBrief } from '../analysis/succession.ts'

export interface LetterSection {
  heading: string
  paragraphs: string[]
  /** Rendered as a numbered list rather than prose. */
  steps?: string[]
}

export interface SuccessorLetter {
  to: string
  title: string
  sections: LetterSection[]
  /** Things this letter deliberately does not contain, listed so nobody adds them. */
  omissions: string[]
}

export function successorLetter(ctx: AnalysisContext, person: Person): SuccessorLetter {
  const { plan } = ctx
  const brief = successionBrief(ctx, person)
  const skill = requiredSkill(plan)
  const multisig = plan.wallets.some((wallet) => isMultisig(wallet))
  const passphrase = plan.keys.some((key) => key.passphrase.enabled)
  // The delay this reader will hit, not the longest one in the plan.
  //
  // One letter goes to a spouse who can open the door today and another to an
  // executor who waits ninety days for the estate. They were getting the same
  // paragraph, which for the spouse is a warning about a wait they will never
  // have, on a document they read once, on the worst day. A letter that tells
  // somebody to expect a delay they do not face teaches them to distrust the
  // rest of it.
  const delayed = plan.locations.filter((location) =>
    location.access.some(
      (access) =>
        access.personId === person.id && access.condition === 'after-death' && access.delayDays > 0
    )
  )

  const sections: LetterSection[] = [
    {
      heading: 'What this is',
      paragraphs: [
        `If you are reading this, I have died or become unable to act, and you are the person I asked to deal with this part of it. I am sorry, and thank you.`,
        `I held some Bitcoin. It is not in a bank and there is no company to ring. It is controlled by ${
          plan.keys.length === 1 ? 'a key' : `${plan.keys.length} keys`
        } that ${plan.keys.length === 1 ? 'is' : 'are'} kept in different physical places. Nothing about it is written in this letter, on purpose.`,
        `There is nothing in this envelope that is worth stealing. The instructions that matter are kept separately, and the next section says how to find them.`,
      ],
    },
    {
      heading: 'What to do first',
      paragraphs: [
        'In order, and slowly. None of this is urgent in hours. All of it is urgent in months.',
      ],
      steps: [
        person.knowsWhereInstructionsAre
          ? 'Find the instruction document. You already know where it is; it is the place I told you about.'
          : 'Find the instruction document. I should have told you where it is and it appears I did not, so look wherever I kept important papers, and ask anybody I would have trusted with an envelope.',
        'Read the whole thing before you touch anything. Do not start collecting objects until you know how many there are.',
        'Take somebody with you when you open a container, and write down what was inside before it moves.',
        'Do not be in a hurry. Nobody can take this from you by being faster than you.',
      ],
    },
    {
      heading: 'What never to do',
      paragraphs: [],
      steps: [
        'Never type words from a metal plate or a piece of paper into a phone, a computer, a search box, a chat window, or a website. Not to check them. Not to see if they are right. There is no legitimate reason to do it and it is how almost all of this is lost.',
        'Never photograph the words, and never let anyone else photograph them.',
        'Never accept help from somebody who contacts you first. Anybody who approaches you about this, by email, phone or message, is stealing from you, without exception.',
        'Never send a "verification" or "unlocking" payment to anybody. That is not a thing that exists.',
      ],
    },
  ]

  if (multisig || passphrase) {
    const points: string[] = []
    if (multisig) {
      points.push(
        'The keys alone are not enough. There is also a wallet configuration file, which is not secret but is essential, and the instructions say where copies of it are. Do not throw away a printed page of long text because it looks like gibberish.'
      )
    }
    if (passphrase) {
      points.push(
        'There is an extra password on top of at least one key. Without it, restoring the key correctly will show an empty wallet. An empty wallet does not mean the money is gone; it usually means the password has not been applied.'
      )
    }
    sections.push({
      heading: 'Two things that will look like failures and are not',
      paragraphs: points,
    })
  }

  if (delayed.length > 0) {
    const worst = Math.max(
      ...delayed.flatMap((location) =>
        location.access
          .filter((access) => access.personId === person.id && access.condition === 'after-death')
          .map((access) => access.delayDays)
      )
    )
    sections.push({
      heading: 'Some of this takes time to open',
      paragraphs: [
        `At least one place will not release anything until the estate is settled, which can take around ${worst} days. That is expected and is not a sign that something has gone wrong. Start the paperwork early and then wait.`,
      ],
    })
  }

  sections.push({
    heading: 'Getting help, safely',
    paragraphs: [
      `Recovering this needs somebody who can ${skill.because}. If that is not you, that is fine and normal.`,
      'Choose the helper yourself, from somebody you already know or a firm you looked up independently. Never let the helper hold the written backups, and never let them take them away. Have them sit beside you while you do the typing.',
      'A helper who wants the words sent to them, or wants to take the metal home, is not a helper.',
    ],
  })

  sections.push({
    heading: 'If you get stuck',
    paragraphs: [
      'Stop. Put everything back where it came from and close it up. Nothing decays, nothing expires, and nothing is lost by waiting a week and trying again with somebody sensible beside you.',
      'The one irreversible mistake is putting the words into a computer. Everything else can be undone by stopping.',
    ],
  })

  const omissions = [
    'No seed words, passphrases, PINs, or private keys.',
    'No addresses, balances, or transaction history.',
    'No street addresses, safe combinations, or container numbers.',
  ]
  if (brief.overlaps) {
    omissions.push(
      'No list of the places the material is kept: together, that list is enough to spend, so it lives in the separate instruction document rather than in an envelope somebody might open early.'
    )
  }

  return {
    to: person.label,
    title: `For ${person.label}, to be opened after my death`,
    sections,
    omissions,
  }
}

export function lettersFor(ctx: AnalysisContext): SuccessorLetter[] {
  return ctx.plan.people
    .filter((person: Person) => person.role === 'successor' || person.role === 'executor')
    .map((person) => successorLetter(ctx, person))
}

export function hasSuccessor(plan: Plan): boolean {
  return plan.people.some((person) => person.role === 'successor' || person.role === 'executor')
}
