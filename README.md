# outlive.diy

A local-only tool for designing and stress-testing a Bitcoin self-custody and
recovery plan.

You describe the _shape_ of a setup: how many keys, what threshold, which
backups sit where, who can reach them. It tells you where that breaks, then
produces the runbook to build it and the recovery route for each way it can
fail.

The name is the requirement. A custody plan has to work when the person who made
it is not available.

**https://outlive.diy**

## It never touches key material

The app reasons about shapes, never about secrets. There is no field anywhere in
it for a seed word, a mnemonic, an extended key, a descriptor, a private key, a
PIN, a passphrase, an address, a balance, or a transaction. Locations and people
are roles: "Site B", "Successor 1".

Every free-text field runs through an input guard that refuses seed words,
extended keys, WIF keys, addresses, descriptors and long hex strings, and tells
you exactly what it recognised and why. The guard is a feature, not a nuisance.

It makes no network calls of its own. No fonts from a CDN, no analytics, no
telemetry, no update check, no error reporting. The one exception is optional
and yours: enter your own Anthropic API key and you can ask Claude about your
plan. Then, and only when you press a button that says Claude, the plan's
structure and findings, with every note removed and checked by the input guard,
go from your browser to `api.anthropic.com`. The Content-Security-Policy allows
that one host and no other, and `make no-network` fails the build if the
policy widens or any other file gains a way out.

If your browser has an AI agent that speaks WebMCP, the app offers it tools:
read the plan, list what is wrong, take things away on the map while you
watch, apply a template or a fix, move a key, change a threshold, undo. They
run in the page on the plan in your browser and make no request. What your
browser's agent does with the answers is between you and whoever makes it.

Your plan lives in your browser, and in files you save yourself.

## What the analysis does

Given a plan, it enumerates and reports:

- **Loss.** Remove any key, device, backup, location or person. Is the threshold
  still reachable, and which wallets survive?
- **Compromise.** The same enumeration from the attacker's side. A written
  backup is a key in their hands; a PIN-locked device is not, until they also
  have you.
- **Correlation.** Keys sharing a vendor, devices sharing an architecture,
  locations in one disaster group, backups one person can reach. Independent
  looking failures that are not.
- **Coercion.** What is reachable in a single session with you cooperating,
  which is what compulsion means.
- **Succession.** Whether the people who outlive you can reach the coins, and
  the other failure nobody talks about: whether they can reach them today.
- **Staleness.** What is believed rather than tested.
- **Time.** How long a recovery that still works actually takes, from the travel
  times, the probate delays and the timelocks already in the plan, measured
  against how long you said you could wait.

Findings are ranked by severity with one concrete remediation each. There is no
score, no grade and no progress bar, because a custody plan that gets a B is not
a thing.

## How you use it

**Build a plan in one screen.** Pick a shape (one key, 2 of 3, 3 of 5, or 2 of 3
with a cosigning service), the places, and click what sits where. The drawing,
the findings and every way it can fail are the real analysis, rerun on every
click. Or describe the setup in a sentence and let Claude fill the builder in.
Every step of describing a plan by hand also starts from a template: a home, a
relative and a second home; three signers from three makers; a key on every
signer with a steel backup; a two of three vault; the standard check schedule.

**Let it find the fixes.** For every finding the engine tries every small change
it knows how to make, runs the whole analysis on each, and offers the ones that
close the finding without opening anything as bad, with a button that makes the
change. The overview leads with the single best next move. "Fix what can be
fixed" applies them in order to a draft and shows the before and after.

**Take things away on the map.** A drawing of the whole plan: wallets, the keys
each threshold needs, every object those keys exist as, the places those
objects sit in, and the people who can open the doors. Click a place, device,
backup or person to take it away and watch every wallet's verdict change;
click again to put it back; take several at once. Every world the engine
enumerates is a strip above it, and a table of every world against every
wallet is on the overview.

**See it as time.** Each recovery route is a bar on one scale, against the time
you said you could wait. Checks sit on the year ahead, late ones in red.

Then a build runbook with the verification gates called out, a recovery route
for each way it fails with how long each one takes, and a successor letter
containing no secrets. All of it prints properly, because these documents get
stored on paper next to the backups.

## Honest about what it is

It models structure. It does not know your real threat, cannot verify anything
you tell it, and is not advice. A plan that produces no findings here is a plan
this program could not find a problem with, which is a much smaller claim than
it sounds like.

## Layout

```
packages/core/     The model, the analysis engine, the guard, the documents.
                   No React, no DOM, no network. This is the product.
apps/web/          One static page that renders it.
tools/             Repository self-checks.
docs/              The threat model, the plan file format, the rule catalogue.
```

The engine is separate from the interface because the engine is the thing that
has to be right. Everything in `packages/core` is pure and tested;
`make test` is the suite that matters.

## Working on it

```bash
make install
make dev        # the app at localhost:3000
make check      # everything CI runs
make test       # both suites: the engine, and the interface driven end to end
make offline    # a copy that opens straight from disk, with no server at all
```

Node 24 or newer, Yarn 1.

## Running it with no server

`make offline` builds `apps/web/out` with relative asset paths, so
`apps/web/out/index.html` opens directly in a browser from the filesystem, with
no server of any kind. There is no back end to miss: the whole application is
one document, some JavaScript, and two font files.

It is the same app, not a degraded one. Opened from a disk it loads with no
failed requests and no console errors, which is checked the same way everything
else here is: by opening it and watching.

## Deploying

Static export on Vercel, configured by `vercel.json`. A push to `main` deploys
production and a pull request gets a preview; `make deploy` and `make preview`
do the same from a checkout. The DNS records the domain needs, and the response
headers that make the no-network claim enforceable, are in
`docs/deploying.md`.

## Licence

MIT. See `LICENSE`.
