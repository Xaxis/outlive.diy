---
name: verify
description: Verify outlive.diy (Next.js static export: a landing page at /, the app at /app/ with fragment views, the terms at /terms/, and the @outlive/core engine). Has the feature map of where every page, view, command and integration lives, how to launch and health-check the app, and a proven recipe for checking each feature. Use to prove a change in this repo works, to find where a feature lives, or to see what a change could break.
---

# Verify outlive.diy

`FM=~/.claude/claude-core/bin/featuremap`

- **Where does a feature live?** Look it up in `features.json` (`id`, `entry`, `reach`,
  `tests`), then read `features/<area>.md` for its recipe. The app's views are
  fragments of `/app/` and are listed by hand in `featuremap.config.json`.
- **What did my change touch?** `$FM affected` (add `--since <base>` on a branch).
  Every feature it lists is in scope.
- **Keeping it current:** when you add, rename, move or remove a feature, run
  `$FM generate --write`, update the matching `features/<area>.md`, and confirm
  `$FM check` exits 0. Commit this with the feature change.

## Static checks

| Check              | Command             | Proves                                                                                                                            | Baseline            |
| ------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| everything CI runs | `make check`        | all of the rows below plus the build                                                                                              | passes, about 3 min |
| typecheck          | `make type-check`   | types in both workspaces                                                                                                          | passes, 16s         |
| lint               | `make lint`         | eslint on the app                                                                                                                 | passes, 12s         |
| format             | `make format-check` | prettier over the repo                                                                                                            | passes, 9s          |
| no network         | `make no-network`   | only `apps/web/lib/ai/client.ts` may import the Anthropic SDK; `vercel.json` `connect-src` is exactly `https://api.anthropic.com` | passes, under 1s    |
| prose              | `make prose`        | no em dashes or emoji                                                                                                             | passes, under 1s    |
| guard data         | `make guard-check`  | checked-in BIP-39 wordlist is current                                                                                             | passes, under 1s    |
| fonts              | `make fonts-check`  | self-hosted fonts match the packages                                                                                              | passes, under 1s    |
| engine tests       | `make test-core`    | 310 tests: rules, fixes, presets, shapes, guard                                                                                   | passes, 12s         |
| app tests          | `make test-web`     | 183 tests driving the whole app in jsdom                                                                                          | passes, about 50s   |
| build              | `make build`        | static export of `/`, `/app/`, `/terms/`                                                                                          | passes, 9s          |

`yarn type-check`, `yarn lint`, `yarn test` and `yarn build` in `features.json` are the
same checks by another name; use the `make` targets, which CI runs.

Known pre-existing failures: none. The app suite can time out a test when the machine
is loaded (another test run, a dev server compiling); rerun it alone before calling
it a regression.

## Launch

```sh
PORT=$(python3 -c "import json;print(json.load(open('.wt.json'))['port'])" 2>/dev/null || echo 4732)
(cd apps/web && npx next dev -p $PORT > /tmp/outlive-$PORT.log 2>&1 & echo $! > /tmp/outlive-$PORT.pid)
until curl -sf localhost:$PORT/app/ >/dev/null; do sleep 1; done
```

Ready when: `curl -sf localhost:$PORT/app/` succeeds. Needs: nothing. There is no
server, no database and no secret; the app reads no environment variables at runtime.
The dev server sends no security header; to check the policy, build and drive the
static output (below) or the deployed site.

Static output instead of dev: `make build && (cd apps/web/out && python3 -m http.server $PORT >/dev/null 2>&1 & echo $! > /tmp/outlive-$PORT.pid)`.

## Doctor

```sh
curl -sf localhost:$PORT/ | grep -q 'Design a Bitcoin custody plan' && curl -sf -o /dev/null localhost:$PORT/app/ && echo ok
```

Run it before the first drive, and again after any failure.

## Drive

Install Playwright once, outside the checkout (it is deliberately not a dependency):

```sh
PW=/tmp/outlive-pw; mkdir -p $PW && (cd $PW && npm i playwright >/dev/null && npx playwright install chromium)
```

Then `scripts/drive.mjs` does one run: clear storage, optionally open a worked example
from the landing page, go to a path, run a step, print a value, screenshot. It always
reports page errors, console errors and every request that left the origin, and
exits 1 on a page error or an outside request that is not Anthropic:

```sh
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT \
  --example "Two of three, three sites" --path "/app/#/map" \
  --do "await p.getByRole('button',{name:/^Site A.*place\./}).first().click()" \
  --print "await p.getByRole('list',{name:/what happens to each wallet/i}).innerText()" \
  --shot /tmp/outlive-map.png
```

Worked examples on the landing page: "One signer, one backup", "Two of three, three
sites", "Two of three, repaired". Look at every screenshot, both themes (the moon
button in the top bar), and at 390 wide (`--width 390`).

The deployed site is `https://outlive.diy`; `--base https://outlive.diy` drives it with
the real security header.

## Evidence

- Record the command and its decisive output: the printed text, the outside-requests
  line (it must be `[]` unless the step asked Claude), the errors line, the screenshot.
- Capture both the action and the resulting state; check side effects through a
  second, read-only view (another view, or `localStorage` read back).
- If a path is unreachable, name the missing precondition and prove the nearest
  real path. Never report it as verified.

## Cleanup

`kill $(cat /tmp/outlive-$PORT.pid)`. Kill only what this run started: other sessions'
servers run on this machine. Keep screenshots outside anything you delete.
