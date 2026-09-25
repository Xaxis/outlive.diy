# Documents

The build runbook, recovery routes and successor letter, on screen and on paper.

<!-- covers: view:#/letter, view:#/recovery, view:#/runbook -->

## Sub-features

- runbook: phases with gates, a sticky phase rail naming the next step, "Mark phase done".
- recovery: a chart of every route against the stated tolerance; click a bar to open the route; step rail; "Draw this world on the map"; "Walk me through it" asks Claude.
- letter: one per successor, containing nothing worth stealing.
- print: every one prints whole, with interactive panels hidden.

## How to reach it

- `/app/#/runbook`, `/app/#/recovery`, `/app/#/letter`; each has a Print button.

## How to check it

Static: `make test-web` ("says, by phase, how far the build has got", "opens a route from its bar on the chart", "records a whole runbook phase").

Runtime:

```sh
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/runbook" --do "await p.getByRole('button',{name:/mark phase done/i}).first().click()" --print "p.getByRole('navigation',{name:'Phases'}).getByRole('button').first().getAttribute('aria-label')"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/recovery" --do "await p.getByRole('button',{name:/^Signer B is lost/}).first().click()" --print "p.locator('[aria-expanded=true]').first().innerText()"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/letter" --do "await p.emulateMedia({media:'print'}); await p.pdf({path:'/tmp/outlive-letter.pdf'})" --print "'pdf written'"
```

Proves it when: the rail reads `Phase 1, Prepare: 3 of 3 done`; the opened route is Signer B's; the PDF opens and reads as a letter with no buttons, drawings or Claude panels on it. Read every printed page.

## Gotchas

- Print is a first-class target: render to PDF and read it after any layout change.
- A recovery route's chart row and list row share a name; tests pick the list row by `aria-expanded`.
