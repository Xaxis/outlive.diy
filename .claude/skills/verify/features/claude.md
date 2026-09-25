# Claude

Ask Claude about the plan with an Anthropic key the reader supplies; the one network request the app can make.

<!-- covers: integration:Ask Claude -->

## Sub-features

- key: entered in place or on `#/file`; memory only unless "remember"; never in the plan store, file or undo; a rejected key is dropped.
- payload: plan structure and findings with every `notes` field removed, refused by the guard if any string is key material; "Exactly what was sent" shows it.
- entry points: overview "Ask Claude" (free text and three suggestions), finding "Ask Claude about this", recovery "Walk me through it", builder "Fill it in".
- lazy SDK: `@anthropic-ai/sdk` loads on the first question.

## How to reach it

- `/app/#/overview` Ask Claude panel; any open finding; any open recovery route; `/app/#/build` describe box; `/app/#/file` Claude section.

## How to check it

Static: `make no-network`; `make test-web` ("asking Claude", `lib/ai/context.test.ts`).

Runtime, with a deliberately invalid key (no cost):

```sh
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/overview" --do "await p.getByRole('button',{name:'Review my plan'}).click(); await p.getByLabel('Anthropic API key').fill('sk-ant-invalid'); await p.getByRole('button',{name:'Use this key'}).click(); await p.getByRole('button',{name:'Review my plan'}).click(); await p.waitForTimeout(5000)" --print "p.getByRole('alert').first().innerText()"
```

Proves it when: it prints `Anthropic did not accept that key.`, the outside-requests line is exactly `["POST api.anthropic.com/v1/messages"]`, and nothing was requested before the key was entered. On `--base https://outlive.diy` the same run proves the deployed policy allows the request.

## Gotchas

- Never run with a real key without the owner's say-so: it bills their account.
- The dev server sends no security header; policy proofs need the static build or the deployed site.
