# Claude

Ask Claude about the plan with an Anthropic key the reader supplies; the one network request the app can make.

<!-- covers: integration:Ask Claude, integration:WebMCP tools -->

## Sub-features

- key: entered in place or on `#/file`; memory only unless "remember"; never in the plan store, file or undo; a rejected key is dropped.
- payload: plan structure and findings with every `notes` field removed, refused by the guard if any string is key material; "Exactly what was sent" shows it.
- entry points: overview "Ask Claude" (free text and three suggestions), finding "Ask Claude about this", recovery "Walk me through it", builder "Fill it in".
- lazy SDK: `@anthropic-ai/sdk` loads on the first question.
- WebMCP tools (`lib/agent/tools.ts`, registered by `lib/agent/register.ts` from `App` once ready): read plan/findings/worlds, go to a view, show a world, take away on the map (animated via `outlive:agent-knockout`), find/apply fix, next move, template, place, threshold, build plan, undo. No network; guarded strings; one undo step and an "Assistant:" toast per change.

## How to reach it

- `/app/#/overview` Ask Claude panel; any open finding; any open recovery route; `/app/#/build` describe box; `/app/#/file` Claude section.

## How to check it

Static: `make no-network`; `make test-web` ("asking Claude", `lib/ai/context.test.ts`).

Runtime, with a deliberately invalid key (no cost):

```sh
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/overview" --do "await p.getByRole('button',{name:'Review my plan'}).click(); await p.getByLabel('Anthropic API key').fill('sk-ant-invalid'); await p.getByRole('button',{name:'Use this key'}).click(); await p.getByRole('button',{name:'Review my plan'}).click(); await p.waitForTimeout(5000)" --print "p.getByRole('alert').first().innerText()"
```

Proves it when: it prints a line beginning `Anthropic did not accept that key.`, the outside-requests line is exactly `["POST api.anthropic.com/v1/messages"]`, and nothing was requested before the key was entered. On `--base https://outlive.diy` the same run proves the deployed policy allows the request.

WebMCP, with a stand-in `document.modelContext` (no browser ships it without a flag):

```sh
cd /tmp/outlive-pw && cat > webmcp-check.mjs <<'JS'
import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage()
await p.addInitScript(() => { window.__t = {}; Object.defineProperty(document, 'modelContext', { value: { registerTool(t) { window.__t[t.name] = t } } }) })
await p.goto(process.env.BASE + '/app/#/build')
await p.waitForFunction(() => window.__t.outlive_build_plan)
const run = (n, i) => p.evaluate(([n, i]) => window.__t[n].execute(i), [n, i])
await run('outlive_build_plan', { threshold: 1, keys: 1 })
console.log(JSON.stringify(await run('outlive_take_away', { labels: ['Site A'] })))
await p.waitForTimeout(1200)
console.log(await p.getByText('Taken away').count(), await p.getByText('Without Site A.').count())
await b.close()
JS
BASE=http://localhost:$PORT node webmcp-check.mjs
```

Proves it when: it prints `[{"wallet":"Vault","spendable":true}]` (the steel plate at Site B still spends) then `1 1` (the map struck Site A out on its own). Real browsers: Chrome Canary with `chrome://flags/#webmcp-for-testing` and the Model Context Tool Inspector extension.

## Gotchas

- Development mode mounts the map twice; the knockout bridge takes its request in a timer so the second mount gets it.

- Never run with a real key without the owner's say-so: it bills their account.
- The dev server sends no security header; policy proofs need the static build or the deployed site.
