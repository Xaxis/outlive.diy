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

**2. It makes no network calls.** No fonts from a content network, no analytics,
no telemetry, no error reporting, no update check. `make no-network` fails the
build if any source under `apps/web` or `packages/core/src` gains a way to reach
the network, and the deployed `Content-Security-Policy` sets
`connect-src 'none'`. This is why the app is one route with fragment routing:
Next's client-side navigation between prerendered pages would need
`connect-src 'self'`, and that would make the claim unenforceable.

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

**A passphrase gates both routes, device and backup.** Memorised, it does not
survive the user. Written beside the seed, it changes nothing. Both are rules.

**The guard's seed-word rule has two thresholds and both matter.** Eight or more
consecutive BIP-39 words is refused whatever they are; three to seven is refused
unless every word is in `AMBIENT_VOCABULARY`. BIP-39 is drawn from common
English, so the literal three-word rule refuses "steel plate, safe" and trains
users to work around the guard. The test suite proves ten thousand generated
mnemonics are still refused, and that the program's own prose passes.

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
that quietly fills in its own blanks is worse than no estimate.

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
