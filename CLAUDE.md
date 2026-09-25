# outlive.diy

A local-only planner for Bitcoin self-custody and recovery. Site at
**outlive.diy**, deployed on Vercel as a static export. The GitHub repo is
`Xaxis/outlive.diy` and the local checkout is `~/Projects/outlive.diy`.

Stack: Yarn 1 workspaces monorepo, Next.js 16 App Router, React 19, Tailwind v4,
TypeScript 5.9, Vitest. Everything runs through `make`.

## The two rules everything else follows from

**1. It never touches key material.** There is no field in the model for a seed
word, mnemonic, extended key, descriptor, private key, PIN, passphrase, address,
balance or transaction, and there must never be one. Locations and people are
roles, never names. Every free-text field goes through `packages/core/src/guard`,
and so does every plan file at the moment it is opened.

**2. It makes no network calls of its own.** No fonts from a content network,
no analytics, no telemetry, no error reporting, no update check. The one
exception is one the reader turns on: asking Claude with their own Anthropic
key, which sends the plan's structure and findings, notes removed and guarded,
from their browser to `api.anthropic.com` and nowhere else, only when they press
a button that says Claude. That request lives in `apps/web/lib/ai/client.ts` and
nowhere else; `make no-network` fails the build if the SDK is imported by any
other file, if any other source gains a way to reach the network, or if the
deployed `Content-Security-Policy` allows any `connect-src` but that one host.
The key is never part of the plan store, the plan file or undo history. This is
also why each document is one route with fragment routing: navigation between
prerendered pages would need `connect-src 'self'`.

If a change would weaken either of these, it is wrong even if the feature is
good.

## Layout

```
packages/core/     The model, the analysis engine, the guard, the documents.
                   No React, no DOM, no I/O, no network. This is the product.
apps/web/          One static page that renders it.
tools/             Repository self-checks and generated data.
docs/              Threat model, plan file format, vendor data format.
```

Inside the engine, `analysis/availability.ts` answers the one question, and
`graph.ts`, `timing.ts` and `implications.ts` ask it in different shapes: what
depends on what, how long getting there takes, and whether the answers on the
purpose page match what was actually built.

The engine is a separate package because the part that has to be right is the
part that reasons, and it is only testable if nothing else is bolted to it.
`make test` is the suite that matters.

## Commands

```bash
make check       # everything CI runs
make check-fast  # the same without the site build
make dev         # the app, locally
make test        # both suites
make test-core   # the engine's alone
```

Neither suite can see the interface. `docs/checking-the-interface.md` says how
to point a browser at it, which is how the defects that mattered were found.

## Things that will bite you

**Three documents, joined by page loads.** `/` is always the landing page,
listing whatever plans this browser holds; `/app/` is the application, every
view a fragment of it; `/terms/` is the terms. Links between them are plain
anchors and `lib/site.ts`, never the framework's client-side navigation, which
would fetch. Hosted links are absolute so server and browser render the same
thing; `make offline` rewrites them relative and gives each nested document its
own `_next`, because chunks loaded later resolve against the document's own
folder. The landing page can start a plan, so every store action that writes
hydrates first: writing before reading would save a file holding only the new
plan. Old `/#/view` links forward to `/app/#/view`.

**A fix is found by trying it, never by reasoning about it.**
`packages/core/src/fixes` proposes every small concrete change, runs `analyze`
on each, and offers only those that close the finding without opening anything
as severe. That is what makes "this closes three findings" a fact rather than a
claim. Structural changes can be applied in bulk to a draft; a record of
something done in the world ("I restored this backup today") is offered one at
a time and never made on the reader's behalf.

**A change is shown as errands.** `diff/actions.ts` turns the difference
between two plans into what somebody would go and do: take this there, copy
that, tell somebody. The comparison and the next move both use it. It invents
nothing: every sentence is a field that differs, in words, and a record of a
check is marked as a record rather than an errand. Applying a change or
adopting a draft appends its errands to `plan.changes`, measured from the plan
being replaced so a draft's own history is not counted twice; the runbook,
the overview, the landing card and the check-in show the open ones, because a
fix applied in one click is the plan running ahead of the world.

**A fix that eases counts, and a wallet that waits is still a wallet.** A
change can leave a finding standing at a lower severity: keeping most of the
balance in a deep vault that opens after 90 days leaves "this can be emptied
in a session" true of the small wallet that is left. `tryFix` reports these as
`shifts` and counts them in its gain, and raising anything to critical counts
as opening one. Adding that fix exposed that the loss rules asked only whether
a wallet could be spent today, which a wallet whose every route is timelocked
never can, so a fire behind one went unreported and the deep vault looked as
if it survived what the vault did not. `loss.ts` now asks those wallets after
their wait. And a chain of changes is applied as the plan it produced, never
by replaying each: a change that creates keys gives them new ids on replay,
and the next change then names keys that do not exist.

**Templates only add.** `model/presets.ts` and the builder's `planFromShape`
never replace or delete what a plan holds, use roles for every name, and are
tested to leave a whole, guard-clean plan. A preset that needs something first
says what instead of doing half of it.

**A short choice is a row of buttons.** `Select` renders up to five short
options as buttons, with "not recorded" as a button of its own, and a longer
list as a dropdown. Do not wrap it back into a dropdown for one field: seeing
every option is the point.

**Every analysis is one question in a different world.** `analysis/availability.ts`
answers "given who can reach what, can this wallet be spent". Loss, compromise,
succession and coercion are all that function with a different `World`. Do not
add a second evaluator: a planner that says a setup survives a fire and also that
it does not is worse than one that says nothing.

**Unknowns resolve in the direction of the question.** A location that is not
recorded counts as reachable when asking whether _you_ can recover, and not
reachable when asking whether somebody standing in one specific room can spend.
That asymmetry is deliberate and lives in `World.unknownPlacementReachable`.

**A multisig wallet needs its descriptor, not just its threshold.** `configAvailable`
gates every multisig spend. This is the most common way a well-built setup turns
out to be unrecoverable, and removing that gate would make the tool cheerful and
wrong.

**A key somebody else holds signs because they cooperate.** Collaborative
custody is a company holding one key of a quorum: they sign with their own key,
on their own device, behind their own door, and none of that is in the plan or
should be. `heldBy` with no recorded device or backup is a third route,
`'holder'`, and not a key with nothing behind it. Treating it as the latter made
a working 2-of-3 read as unspendable today. The rules about what a key exists as
stay quiet for a held key too: "write Key C down on a durable medium" is advice
the customer cannot follow and that would defeat the arrangement if they could.
`S025` says the thing that is true instead, which is that the redundancy behind
it is invisible from here.

**A passphrase gates both routes, device and backup.** Memorised, it does not
survive the user. Written beside the seed, it changes nothing. Both are rules.

**The guard's seed-word rule has two thresholds and both matter.** Eight or more
consecutive BIP-39 words is refused whatever they are; three to seven is refused
unless every word is in `AMBIENT_VOCABULARY`. BIP-39 is drawn from common
English, so the literal three-word rule refuses "steel plate, safe" and trains
users to work around the guard. The test suite proves ten thousand generated
mnemonics are still refused, and that the program's own prose passes.

**A seed has three other written forms and the guard knows all of them.** Four
letters to a word, which is how a metal plate is stamped and is unambiguous
because BIP-39 guarantees it; wordlist positions as numbers; and the raw
entropy in hexadecimal, where the threshold is 32 characters and not 64 because
128 bits is the commonest seed there is. The four-letter pass is deliberately
separate from the whole-word pass and fires only at the hard length: a prefix is
a far weaker signal, and "week", "plan" and "read" are all of them.

**The guard stops a careless paste, not a determined author.** Words run
together, a filler word between each one, three-letter abbreviations and base64
all get past it, and no pattern rule closes that. Say so when describing it. The
claim it earns is that key material cannot be stored here by accident.

**A field that saves as you type commits the longest thing the guard allowed.**
So part of a seed lands while the rest is still being typed. Two things keep
that window small and both are load-bearing: the four-letter rule fires after
four pieces of nonsense rather than after twelve words, and `GuardedInput` puts
the stored value back to where the typing started when a refused field is left.
Do not make a threshold laxer without checking what a field would then hold
half way through.

**Do not populate `vendors/`.** Device facts rot. The shipped vendor data is
empty on purpose, the engine runs identically without it, and anything it does
say is rendered as a dated claim from a file the user loaded rather than as a
conclusion.

**The picture and the list are the same answer.** `analysis/graph.ts` turns the
plan into nodes and edges and evaluates every one of them with the predicates
exported from `availability.ts`, never with its own. A diagram that says a
backup is in reach while the finding beside it says the opposite is worse than
no diagram. The layout arithmetic lives in `apps/web/lib/graph-layout.ts`
instead, because where a box goes on a screen is not a question about custody.

**The diagram's colours invert with the actor.** Asked whether you can recover,
an unreachable box is the failure. Asked what somebody standing in one room can
take, a reachable box is the failure, and painting their empty hands red tells
the reader that good news is bad. Same rule as `World.unknownPlacementReachable`,
applied to paint.

**The map is the diagnosis, not a picture of it.** A click on a box takes it
away and a second click puts it back; several can be gone at once, and every
wallet's verdict sits on the drawing so the answer is where the click was. The
worlds the engine enumerates are a strip above the drawing, which leaves the
drawing the full width it needs to be read, and knockouts compose on top of
the chosen world through `without`, never through a second evaluator. There
used to be a stress test page listing every world without drawing any of them,
then a list beside a drawing too narrow to read, where taking a thing away
meant finding its world in the list. The composer's `onChange` runs from an
effect: pass it something stable, or every render wipes the knockouts.

**A box moves up and down its column and never out of it.** The column a box
sits in is information: wallets, what they need, keys, the material a key exists
as, places, people. Across that boundary a box would state something false, and
a drawing that can be rearranged into a lie is worse than one that cannot be
rearranged at all. Within a column it says nothing false, and it is how a reader
untangles one corner of a plan with forty keys in it, so dragging and alt with
an arrow key both do it. The arrangement lives in the component and not in the
plan file: where a box sits on a screen is not a fact about custody, and a plan
handed to somebody else should arrive in the order the layout argues for.

**A verdict is painted from one table.** The overview's matrix, the rail
beside the map, the wallet standing, the compare diff and the landing page all show survives, no
spare, unspendable or theirs to spend, and all of them take the word, the
glyph and the colour from `apps/web/lib/verdict.ts`. The matrix is an index
into the map and not a second answer: every cell is a scenario the engine
enumerated, and clicking one draws it. A summary that computed its own
verdicts would be the second evaluator the engine exists to prevent.

**Motion on the diagram is news, not decoration.** A box pulses once when a
new world flips its answer, and a traced chain flows towards the wallet only
along dependencies that hold. Nothing else moves. Reduced motion removes the
movement and leaves the colour and dashes, which carry the same news.

**Every recovery is measured against what the purpose page was told.** The
chart on the recovery page draws each route on one scale with the stated
tolerance through all of them. A route with no recovery gets no bar, because a
bar of any length says it ends, and a floor is marked as one.

**There is one place a plan is described, and it is guided.** `lib/sections.ts`
holds the seven steps with one purpose sentence and one done rule each, and
`views/DesignView.tsx` is the only screen that renders them. There used to be a
tabbed editor and a guided route over the same seven editors, with two sets of
section blurbs that had drifted apart, and a reader whose first decision was
which door to use. Guidance is not a mode: every section says why it is being
asked before the fields and what the answer did to the analysis after them.

**Every answer on the purpose page has to change something visible.**
`analysis/implications.ts` pairs each one with the thing in the plan it governs
and measures: the horizon against the media the keys are written on, the
tolerance against how long the slowest surviving recovery really takes. Those
four questions were number fields with help text, answered with round numbers
nobody meant, and the rest of the analysis was then measured against them. An
option that states what it commits you to is answered on purpose.

**`analysis/timing.ts` invents nothing.** Travel, probate and timelocks all come
from fields the user filled in. Anything not recorded is reported in `unknowns`
and contributes zero, so the figure is a floor and says so. A recovery estimate
that quietly fills in its own blanks is worse than no estimate. Each unknown
carries the `Ref` whose own record would answer it, so the interface offers the
field rather than only naming the gap; a `null` subject means the model has no
field for it and the wording says so instead of promising one.

**A rule that is right in its headline can be wrong in a subset.** S012 said a
device holding two keys made the path "really 1-of-1", which is true when the
device holds the whole threshold and false when it holds part of it: two of five
on one device is 2-of-4, not 1-of-1. The severity now depends on which it is.
When adding a rule, ask what it says about the case just inside its condition.

**And a remediation can create another rule's finding.** X001 advised a
timelocked path as "the only route to the balance", which is exactly what S020
warns against. The examples exercise 26 of the 65 rules, so most remediations
had never been read beside each other.

**Every rule has to have had its sentence read.** `shapes.fixture.ts` keeps the
plan shapes, each the smallest mutation that makes a family of rules speak, and
`self-check.test.ts` asserts that between them and the examples every rule
fires. Every sentence they produce goes through the guard and through a
pluralisation check, one shape at a time and then in all seven hundred pairs,
because nothing goes wrong one thing at a time. That found five sentences this
program's own guard refused and three that disagreed with their own number, all
in rules no example exercises. Add a rule, add a shape: the assertion will tell
you. A mutation must be a no-op when the thing it changes is absent, or the
pairs cannot compose.

**Findings never carry a score.** No grade, no percentage, no progress bar to
secure. A number is read as a target and gets optimised. What the user's stated
concerns change is the _order_ findings are read in, never whether they appear.

**Print is a first-class target.** The runbook, the recovery routes and the
successor letter get stored on paper next to the backups, because a recovery
document that only exists on the machine you have lost is not one. Render them
to PDF and read them before changing their layout.

**Nothing is encoded in colour alone.** Severity is named as well as coloured,
in-text links are underlined, and every step of the text ramp clears 4.5:1
against every ground it sits on. `apps/web/lib/palette.test.ts` enforces the
last of those; the other two need a person.

**An empty plan is not a clean bill of health.** Every derived view says so
explicitly, in the same words, because silence from a program that has been
given nothing reads as reassurance on a tool whose job is to be unflattering.

**Nor is a half-built one.** The drawing starts at the wallets and walks down,
so a key no spend path uses is not in it, and nor is the device or place or
person behind that key. That is correct and it is also how five described
things produce a two-box picture, which reads as lost data. `buildGraph`
returns `omitted` and the drawing says what it left out. `S024` says the same
thing as a finding, because a key nothing can spend with is the one case every
other structure rule is silent about.

**Move between views by assigning the fragment, never `history.pushState`.**
Next patches pushState and replays each call as a transition of its own
router; two in quick succession left the app drawing the first view with the
second in the address bar. `setFragment` in `lib/router.ts` is the one way.

**A browser's own agent drives the page with the reader's hands.**
`lib/agent/tools.ts` registers WebMCP tools (`document.modelContext`, or
`navigator.modelContext` in older builds) so an AI agent built into the
reader's browser can read the plan, list findings and worlds, take things away
on the map, and apply templates, fixes, placements and thresholds. They run in
the page and send nothing anywhere, so the policy does not change. Every string
an agent passes goes through the guard; every change is one undo step and a
toast that begins "Assistant:"; a fix that records something done in the world
is applied only when the reader says they did it. No tool reaches the Claude
key or the Claude request. What the agent does with an answer is the browser's
business, and the terms say so.

**A check is one record.** `checksDue` lists the scheduled checks that are
late and every check a staleness rule says was never done, whether or not
anybody scheduled it; the overview, the landing cards and the check-in all read
it. A runbook gate names the check it is (`RunbookStep.records`): ticking it
records that check, and a check recorded anywhere shows the gate as passed.
The runbook and the checks used to be two stores, and a restored backup ticked
in one read as never restored in the other.

**Runbook progress lives in the plan file,** not in browser storage. Building one
of these takes weeks; "half done, and here is which half" is state worth saving
and handing over.

## Style

Second person, imperative in procedures. Direct and unhyped. Sentence case
headings. No em dashes, no emoji. Comments explain _why_, especially where a
non-obvious constraint drove the design; the code already says what.

The interface never congratulates the user. A plan with no findings means this
program could not find a problem, which is a much smaller claim than it sounds
like, and the copy says so.

## Environment

`.env` at the repository root, never committed, documented by `.env.example`. It
holds `NEXT_PUBLIC_SITE_URL` and a Vercel CLI token, and that is all it should
hold. The application reads no environment variables at runtime.
