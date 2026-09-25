# Describe a plan

Build a plan by its shape in one screen, or describe it step by step with templates, grids and pickers.

<!-- covers: view:#/build, view:#/design/<step> -->

## Sub-features

- builder: shape presets (one key, 2 of 3, 3 of 5, collaborative), "Is this already built?" (marks the building steps of the runbook done, never the gates), "If you die" (nobody, a successor, successor and executor), places, what-goes-where grid, live drawing, findings and failure matrix; "Create this plan".
- describe in words: a sentence becomes a shape through Claude (see claude.md).
- templates: each design step has a "Start from" row from `packages/core/src/model/presets.ts`; they only add, and are one undo.
- step visual: "What goes where" grid, "Drawing" or "Hide"; the checks step shows "The year ahead" calendar instead.
- devices: maker and model dropdowns with "Other…" opening a text field; the name follows what it is ("Coinkite Coldcard Q") until the reader types their own in "Name, if you want one"; device shelf with maker bar.
- keys: "Device it lives on" offers each device by what it is (`deviceChoiceLabel` in `lib/devices.ts`), with the reader's own name when they gave one.
- choices: up to five short options render as buttons.
- quorum card: each spend path is one card, its keys as chips and a keys-needed stepper, with name, purpose and timelock folded inside it.
- places and roles: tiles with icons; travel presets.

## How to reach it

- `/app/#/build`, landing "Build a plan", sidebar Builder, plan menu "Build a new plan".
- `/app/#/design/profile` … `locations`, `people`, `devices`, `keys`, `wallets`, `checks`; landing "Describe one by hand".

## How to check it

Static: `make test-web` ("building a plan by its shape", "starting a step from a template", "a device, picked rather than typed", "a way to spend", "what goes where", "the year ahead"); `make test-core` (`model/shape.test.ts`, `model/presets.test.ts`).

Runtime:

```sh
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --path "/app/#/build" --do "await p.getByRole('button',{name:/create this plan/i}).first().click(); await p.waitForTimeout(800)" --print "p.locator('h1').first().innerText()"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/design/devices" --do "await p.getByRole('combobox',{name:'Maker'}).selectOption('Coinkite'); await p.getByRole('combobox',{name:'Maker'}).selectOption('Other…'); await p.getByRole('textbox',{name:'Maker name'}).fill('Homebrew'); await p.getByRole('textbox',{name:'Maker name'}).blur()" --print "p.evaluate(()=>JSON.parse(localStorage.getItem('outlive.diy/plan-file/v1')).plans[0].devices[0].vendor)"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path "/app/#/design/wallets" --do "await p.getByRole('button',{name:/more keys needed/i}).click()" --print "p.getByRole('group',{name:/everyday: keys needed/i}).innerText()"
```

Proves it when: the builder lands on a heading of `My plan`; the stored maker reads back `Homebrew`; the quorum reads `3 of 3`.

## Gotchas

- The builder has "Create this plan" at the top and again at the bottom; a recipe takes `.first()`.
- A worked example's devices have typed makers, so the Maker dropdown reads "Other: Vendor One" and has no "Other…" until a listed maker is picked.

- Store actions that write hydrate first; a test that sets `ready: false` exercises that.
- The design step's pictures use a deferred copy of the plan, so they lag typing by a frame on purpose.
- `Select` becomes buttons at five short options or fewer; a test using `selectOptions` on it will fail, use the button.
