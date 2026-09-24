import { inspect, inspectDeep, type AnalysisReport, type Plan } from '@outlive/core'

/**
 * What leaves the browser when the reader asks Claude, and nothing else.
 *
 * The plan's structure and the engine's findings about it. Every free-text
 * field is removed first: notes are where somebody might have written a name,
 * an address or worse, and nothing Claude is asked needs them. What is left
 * goes through the same key-material guard every field does, and if anything
 * in it is refused, nothing is sent at all. The reader can see this exact
 * payload before it goes.
 */

export class RefusedToSend extends Error {}

function withoutNotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNotes)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'notes') continue
      out[key] = withoutNotes(entry)
    }
    return out
  }
  return value
}

export function planContext(plan: Plan, report: AnalysisReport | null) {
  const payload = {
    plan: withoutNotes({
      name: plan.name,
      profile: plan.profile,
      locations: plan.locations,
      people: plan.people,
      devices: plan.devices,
      keys: plan.keys,
      wallets: plan.wallets,
      verifications: plan.verifications,
    }),
    findings: (report?.findings ?? []).map((finding) => ({
      id: finding.id,
      rule: finding.rule,
      severity: finding.severity,
      title: finding.title,
      detail: finding.detail,
      remediation: finding.remediation,
    })),
  }
  assertSendable(payload)
  return payload
}

/** Refuse, rather than send, anything the guard would not store. */
export function assertSendable(value: unknown): void {
  // Refusals only, the same line every field draws. Warnings fire on ordinary
  // English, this program's own findings included, because the seed wordlist
  // is drawn from it.
  const hits = inspectDeep(value).filter((hit) => hit.strength === 'refuse')
  if (hits.length > 0)
    throw new RefusedToSend(
      `Not sent: ${hits[0].field || 'the plan'} looks like key material. Nothing left this browser.`
    )
}

export function assertQuestionSendable(text: string): void {
  const result = inspect(text)
  const refusal = result.hits.find((hit) => hit.strength === 'refuse')
  if (refusal)
    throw new RefusedToSend(
      `Not sent: ${refusal.found}. ${refusal.reason} Nothing left this browser.`
    )
}

export const SYSTEM = `You are helping someone review the structure of their Bitcoin self-custody plan inside outlive.diy, a planner that models keys, devices, backups, places and people, and analyses what happens when things are lost, stolen, or when the owner dies.

You are given the plan as JSON and the engine's findings. The engine's findings are computed facts about the model: do not contradict them, and ground everything you say in the plan you were given. Places and people are roles (Site A, Successor 1), never real names; refer to things by those labels.

Never ask for, and never accept, seed words, private keys, extended keys, descriptors, addresses, PINs or passphrases. If the reader seems about to share any, tell them to stop and not to put it anywhere.

Be direct and concrete. When you suggest a change, say it as an edit they can make in the app ("move Key B's steel plate to Site C"), and say what it trades off. Do not grade the plan or give it a score. This is structure, not financial or legal advice; say so only if the question asks for advice.

Keep answers short: a few short paragraphs or a short list. Use plain markdown: paragraphs, "- " bullets and **bold**, nothing else.`
