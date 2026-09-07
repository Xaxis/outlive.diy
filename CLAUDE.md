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

The engine is a separate package because the part that has to be right is the
part that reasons, and it is only testable if nothing else is bolted to it.
`make test` is the suite that matters.

## Commands

```bash
make check       # everything CI runs
make check-fast  # the same without the site build
make dev         # the app, locally
make test        # the engine's suite alone
```

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

**Findings never carry a score.** No grade, no percentage, no progress bar to
secure. A number is read as a target and gets optimised. What the user's stated
concerns change is the _order_ findings are read in, never whether they appear.

**Print is a first-class target.** The runbook, the recovery routes and the
successor letter get stored on paper next to the backups, because a recovery
document that only exists on the machine you have lost is not one.

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
