'use client'

import type AnthropicSdk from '@anthropic-ai/sdk'

type Sdk = typeof AnthropicSdk

/**
 * Loaded on the first question, not with the page. Almost nobody who opens
 * this program will enter a key, and the SDK was over half of what every
 * visitor downloaded before seeing anything.
 */
let sdk: Sdk | null = null
async function load(): Promise<Sdk> {
  if (!sdk) sdk = (await import('@anthropic-ai/sdk')).default
  return sdk
}

/**
 * The one place this application talks to anything.
 *
 * outlive.diy makes no network calls, with one exception the reader turns on
 * themselves: asking Claude, with their own Anthropic key. Every request in the
 * program goes through this file and only to Anthropic, the deployed security
 * policy allows that one host and no other, and `tools/check-no-network.mjs`
 * fails the build if the SDK is imported anywhere else. Nothing is sent unless
 * the reader has entered a key and pressed a button that says it asks Claude.
 *
 * What is sent is built by `context.ts`, which strips free text and puts the
 * whole payload through the key-material guard before it gets here.
 */

export const MODEL = 'claude-opus-5'

export interface Ask {
  apiKey: string
  system: string
  prompt: string
  /** A JSON schema the answer must follow, for answers the program reads. */
  schema?: Record<string, unknown>
  onText?: (delta: string) => void
  signal?: AbortSignal
}

export class ClaudeRefused extends Error {}

export async function askClaude(ask: Ask): Promise<string> {
  const Anthropic = await load()
  const client = new Anthropic({
    apiKey: ask.apiKey,
    // The key is the reader's own, held in their own browser, and sent only
    // to Anthropic. The SDK's warning is about shipping a developer's key to
    // strangers, which is not what this is.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  })
  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 16000,
      // A declined request is re-run on Anthropic's recommended fallback
      // rather than coming back empty.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      ...(ask.schema
        ? { output_config: { format: { type: 'json_schema', schema: ask.schema } } }
        : {}),
      system: ask.system,
      messages: [{ role: 'user', content: ask.prompt }],
    },
    { signal: ask.signal }
  )
  if (ask.onText) stream.on('text', ask.onText)
  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') {
    throw new ClaudeRefused('Claude declined to answer this one.')
  }
  return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
}

/** Anthropic said the key is not a key. It is dropped, and asked for again. */
export function isBadKey(error: unknown): boolean {
  return sdk !== null && error instanceof sdk.AuthenticationError
}

/** A sentence a reader can act on, for anything the request threw. */
export function explainError(error: unknown): string {
  if (error instanceof ClaudeRefused) return error.message
  // Any error from a request came after the SDK loaded; before that, there
  // is nothing it could be but ours.
  const Anthropic = sdk
  if (!Anthropic) return error instanceof Error ? error.message : 'Something went wrong.'
  if (error instanceof Anthropic.AuthenticationError)
    return 'Anthropic did not accept that key. Check it and enter it again.'
  if (error instanceof Anthropic.PermissionDeniedError)
    return 'That key is not allowed to use this model.'
  if (error instanceof Anthropic.RateLimitError)
    return 'Anthropic is rate limiting this key. Wait a minute and try again.'
  if (error instanceof Anthropic.APIUserAbortError) return 'Stopped.'
  if (error instanceof Anthropic.APIConnectionError)
    return 'Could not reach Anthropic. Check the connection, or whether something is blocking it.'
  if (error instanceof Anthropic.APIError) return `Anthropic returned an error (${error.status}).`
  return error instanceof Error ? error.message : 'Something went wrong.'
}
