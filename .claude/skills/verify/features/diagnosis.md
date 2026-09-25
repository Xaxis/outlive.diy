# Diagnosis

What breaks, what to do about it, and the map where things are taken away.

<!-- covers: view:#/findings, view:#/map, view:#/overview -->

## Sub-features

- next move: the overview names the single change that closes most without opening anything critical; "Apply this change" applies it; the toast's Undo (or Cmd-Z) undoes, and the toast reads "Closed N." or "Closed N, opened M.".
- every way it fails: overview matrix of worlds by wallets; a cell opens that world on the map.
- checks due: "Checks due" lists never-done checks (plain circle, "not done yet") and late ones (warning, "N days overdue"), each with "Done today". "Fix all in a draft" is hidden when the next-move search finds nothing.
- fixes: an open finding lists changes found by trying them (`packages/core/src/fixes`), with Apply; records say "Record it".
- fix all in a draft: applies every structural fix to a draft and opens compare.
- finding picture: an open finding draws its world with its subjects tagged "this".
- map: click a place, device, backup, key or person to take it away, again to restore; verdict chips above the drawing; worlds strip; full screen; [ and ] step worlds; "Click explains" mode shows the box detail.

## How to reach it

- `/app/#/overview`, `/app/#/findings`, `/app/#/findings/<finding id>`, `/app/#/map`, `/app/#/map/<scenario id>`.

## How to check it

Static: `make test-web` ("the next move", "fixing a finding", "the map, as one instrument", "stepping through worlds", "a finding and its picture"); `make test-core` (`fixes/fixes.test.ts`).

Runtime:

```sh
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/overview" --do "await p.getByRole('button',{name:/apply this change/i}).click()" --print "p.getByText(/^Closed \\d+\\.( |$)/).count()"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/findings" --do "await p.getByText(/Vault has only one copy/).click(); await p.getByRole('button',{name:/^apply$/i}).first().click()" --print "p.getByText(/Vault has only one copy/).count()"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/map" --do "await p.getByRole('button',{name:/^Site A.*place\./}).first().click()" --print "p.getByRole('list',{name:/what happens to each wallet/i}).innerText()"
```

Proves it when: the first prints `1` (the toast reads "Closed N." with an Undo button); the second prints `0`; the third shows Vault and Daily `unspendable` and the outside-requests line is `[]`.

## Gotchas

- The next move and fix searches run hundreds of analyses; they start after a paint and show "Trying…" first. Wait for the button.
- The map composer's `onChange` runs from an effect; pass it something stable or every render clears the knockouts.
- The map's height is bounded by the drawing; the page reserves its scrollbar gutter, or height and width chase each other.
