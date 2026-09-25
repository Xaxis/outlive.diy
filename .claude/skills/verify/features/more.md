# More

Comparing plans, the plan file and storage, and the rules.

<!-- covers: view:#/compare, view:#/file, view:#/reasoning -->

## Sub-features

- compare: findings closed and opened, "What you would do" (the change as numbered errands from `describeActions` in `packages/core/src/diff/actions.ts`), the world-by-world diff, both drawings with changed boxes tagged; "Use this version" adopts a draft into the original. The overview's next move folds the same errands under "What that means doing".
- file: what leaves the browser, where the plan is kept, Claude key settings, plans open, vendor data, everything stored, erase.
- reasoning: the rules by category, with the assumptions folded above them.

- unsaved: the top bar's Save carries a dot, and says "changes not yet saved to a file", while the browser holds changes no file has; the flag (`outlive.diy/unsaved/v1`) survives a reload and clears on a file save.

## How to reach it

- `/app/#/compare`, `/app/#/file`, `/app/#/reasoning`; overview "Try a change as a draft"; "Fix all in a draft".

## How to check it

Static: `make test-web` ("drafts", "fixes what can be fixed as a draft", "a change that closes nothing").

Runtime:

```sh
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/findings" --do "await p.getByRole('button',{name:/fix all in a draft/i}).click(); await p.waitForURL(/compare/,{timeout:20000}); await p.getByRole('button',{name:/use this version/i}).click()" --print "p.evaluate(()=>JSON.parse(localStorage.getItem('outlive.diy/plan-file/v1')).plans.length)"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/file" --print "p.getByText('connect-src https://api.anthropic.com').count()"
```

Proves it when: the first prints `1` (the draft adopted into the original); the second prints `1`.

## Gotchas

- Worlds and wallets in the compare diff are matched by id, which a fork keeps; plans from two separate examples have different ids.
